import { Server, Socket } from 'socket.io';
import { prisma } from '../index';

/* ── Types ── */
interface QuizAnswer   { id: string; text: string; isCorrect: boolean; }
interface QuizQuestion { id: string; text: string; answers: QuizAnswer[]; timeLimit: number; }
interface PlayerData {
  name: string; score: number; combo: number; maxCombo: number;
  shield: number; maxShield: number;
  correctCount: number; wrongCount: number;
  fastAnswers: number;
  lives?: number;          // Battle Royale
  eliminated?: boolean;     // Battle Royale
  team?: 'RED' | 'BLUE';    // Team Battle
  connected: boolean;
  socketId: string;
}

interface RoomData {
  hostId:               string;
  bossHp:               number;
  maxBossHp:            number;
  players:              Record<string, PlayerData>;
  spectators:           Set<string>;
  status:               'WAITING' | 'PLAYING' | 'FINISHED';
  currentQuestionIndex: number;
  questions:            QuizQuestion[];
  answeredThisRound:    Set<string>;
  wrongThisRound:       number;
  cheatingLog:          Array<{ socketId: string; name: string; type: string; time: string }>;
  mode:                 'BOSS_BATTLE' | 'BATTLE_ROYALE' | 'TEAM_BATTLE';
  redScore?:            number; // Team Battle
  blueScore?:           number; // Team Battle
  maxPlayers:           number; // Monetization Tier Limit
  questionStartTime?:   number;
  socketToPlayer:       Record<string, string>; // Mapping socketId -> playerId
}

const rooms  = new Map<string, RoomData>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const tickTimers = new Map<string, ReturnType<typeof setInterval>>();

// Rate limiter state
const rateLimitMap = new Map<string, number>();

function isRateLimited(socketId: string, limitMs: number = 300): boolean {
  const lastTime = rateLimitMap.get(socketId) || 0;
  const now = Date.now();
  if (now - lastTime < limitMs) return true;
  rateLimitMap.set(socketId, now);
  return false;
}

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code  = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return rooms.has(code) ? genCode() : code;
}

function clearTimer(code: string) {
  const t = timers.get(code);
  if (t) { clearTimeout(t); timers.delete(code); }
}

function clearTickTimer(code: string) {
  const t = tickTimers.get(code);
  if (t) { clearInterval(t); tickTimers.delete(code); }
}

function publicRoom(r: RoomData) {
  return {
    bossHp: r.bossHp, maxBossHp: r.maxBossHp,
    players: r.players, status: r.status,
    currentQuestionIndex: r.currentQuestionIndex,
    totalQuestions: r.questions.length,
    cheatingLog: r.cheatingLog,
    mode: r.mode,
    redScore: r.redScore,
    blueScore: r.blueScore,
  };
}

function calcXP(score: number, rank: number, bossDefeated: boolean): number {
  const base  = Math.floor(score / 10);
  const rankB = rank === 1 ? 100 : rank === 2 ? 60 : rank === 3 ? 40 : 20;
  const winB  = bossDefeated ? 50 : 0;
  return Math.max(10, base + rankB + winB);
}

async function persistGameResults(code: string, results: any[], bossDefeated: boolean, cheatingLog: any[]) {
  try {
    // 1. Update Room status to FINISHED
    const room = await prisma.room.update({
      where: { code },
      data: { status: 'FINISHED' }
    });

    // 2. Resolve Users (Upsert) and accumulate their new data
    // Karena SQLite tidak punya 'createMany' dengan skipDuplicates, kita gunakan $transaction array
    const upsertUserQueries = results.map(player => {
      const email = `${player.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}@siswa.edubattle.local`;
      return prisma.user.upsert({
        where: { email },
        update: {
          xp: { increment: player.xpEarned }
        },
        create: {
          email,
          name: player.name,
          role: 'SISWA',
          xp: player.xpEarned,
          level: 1,
          rank: 'BRONZE'
        }
      });
    });

    // Jalankan semua upsert user secara bersamaan
    const savedUsers = await prisma.$transaction(upsertUserQueries);

    // Build a Map for safe lookup by name (order from $transaction not guaranteed)
    const userByName = new Map<string, typeof savedUsers[0]>();
    savedUsers.forEach(u => userByName.set(u.name, u));
    const rankUpdates: any[] = [];
    const sessionCreates: any[] = [];

    const ranks = [
      { name: 'BRONZE', minXP: 0 },
      { name: 'SILVER', minXP: 1000 },
      { name: 'GOLD', minXP: 5000 },
      { name: 'PLATINUM', minXP: 15000 },
      { name: 'MYTHIC', minXP: 50000 },
    ];

    results.forEach((player) => {
      const user = userByName.get(player.name);
      if (!user) return; // safety: user not found in saved batch
      const newLevel = Math.max(1, Math.floor(Math.sqrt(user.xp / 50)));
      const newRank = [...ranks].reverse().find(r => user.xp >= r.minXP)?.name ?? 'BRONZE';

      // Queue Rank/Level update if changed
      if (user.level !== newLevel || user.rank !== newRank) {
        rankUpdates.push(
          prisma.user.update({
            where: { id: user.id },
            data: { level: newLevel, rank: newRank }
          })
        );
      }

      // Queue Session & Analytics
      const cheatCount = cheatingLog.filter(c => c.name === player.name).length;
      sessionCreates.push(
        prisma.session.create({
          data: {
            userId: user.id,
            roomId: room.id,
            score: player.score,
            combo: player.combo,
            analytics: {
              create: {
                correctCount: player.correctCount,
                wrongCount: player.wrongCount,
                avgTime: 0,
                cheatingAttempts: cheatCount
              }
            }
          }
        })
      );
    });

    // Execute session and rank updates in one transaction block
    await prisma.$transaction([...rankUpdates, ...sessionCreates]);
    console.log(`[RoomDB ${code}] Batched game results persisted successfully for ${results.length} players.`);

  } catch (err) {
    console.error(`[RoomDB ${code}] Error persisting batched game results:`, err);
  }
}

function sendQuestion(io: Server, code: string) {
  const r = rooms.get(code);
  if (!r || r.status !== 'PLAYING') return;

  // Filter out eliminated players in Battle Royale
  const activePlayers = Object.entries(r.players).filter(([_, p]) => r.mode !== 'BATTLE_ROYALE' || (!p.eliminated && p.connected));

  if (r.currentQuestionIndex >= r.questions.length || (r.mode === 'BATTLE_ROYALE' && activePlayers.length === 0)) {
    // Game over
    clearTickTimer(code);
    r.status = 'FINISHED';
    const sorted = Object.entries(r.players).sort(([,a],[,b]) => b.score - a.score);
    const bossDefeated = r.mode === 'BOSS_BATTLE' ? r.bossHp <= 0 : true;

    // Include XP earnings per player
    const results = sorted.map(([sid, p], i) => ({
      ...p, socketId: sid, rank: i + 1,
      xpEarned: calcXP(p.score, i + 1, bossDefeated),
    }));

    io.to(code).emit('game_over', { players: results, bossDefeated, winnerTeam: r.mode === 'TEAM_BATTLE' ? ((r.redScore || 0) > (r.blueScore || 0) ? 'RED' : 'BLUE') : undefined });
    io.to(code).emit('room_update', publicRoom(r));
    console.log(`[Room ${code}] Game over. Mode: ${r.mode}`);

    // Persist results asynchronously
    persistGameResults(code, results, bossDefeated, r.cheatingLog);
    return;
  }

  const q = r.questions[r.currentQuestionIndex];
  r.answeredThisRound = new Set();
  r.wrongThisRound    = 0;

  // Send question WITHOUT correct answer
  const pubQ = {
    id: q.id, text: q.text, timeLimit: q.timeLimit,
    answers: q.answers.map(a => ({ id: a.id, text: a.text })),
  };

  io.to(code).emit('question_start', {
    question: pubQ,
    index: r.currentQuestionIndex,
    total: r.questions.length,
  });

  r.questionStartTime = Date.now(); // ANTI-CHEAT: Server tracks time

  clearTimer(code);
  timers.set(code, setTimeout(() => advanceQuestion(io, code), (q.timeLimit + 1) * 1000));
}

function advanceQuestion(io: Server, code: string) {
  const r = rooms.get(code);
  if (!r || r.status !== 'PLAYING') return;
  clearTimer(code);

  const q       = r.questions[r.currentQuestionIndex];
  const correct = q.answers.find(a => a.isCorrect);
  io.to(code).emit('question_end', {
    correctAnswerId: correct?.id ?? '',
    correctText:     correct?.text ?? '',
  });

  // Deduct lives for active players who did not answer or answered incorrectly in Battle Royale
  if (r.mode === 'BATTLE_ROYALE') {
    Object.entries(r.players).forEach(([pid, p]) => {
      if (!p.eliminated && p.connected && !r.answeredThisRound.has(pid)) {
        p.combo = 0;
        p.lives = Math.max(0, (p.lives || 3) - 1);
        if (p.lives === 0) {
          p.eliminated = true;
          io.to(code).emit('boss_attack', { damage: 0, message: `${p.name} TERELIMINASI!` });
        }
      }
    });
  }

  // Boss attacks if > 50% of players got it wrong (Only in Boss Battle mode)
  const totalPlayers = Object.keys(r.players).length;
  if (r.mode === 'BOSS_BATTLE' && totalPlayers > 0 && r.wrongThisRound / totalPlayers > 0.5) {
    const bossDmg = Math.floor(r.maxBossHp * 0.05); // 5% of max HP
    // Reduce all players' shields
    Object.values(r.players).forEach(p => {
      p.shield = Math.max(0, p.shield - bossDmg);
    });
    io.to(code).emit('boss_attack', {
      damage: bossDmg,
      message: `BOSS ATTACKS! ${r.wrongThisRound}/${totalPlayers} warriors failed!`,
    });
  }

  r.currentQuestionIndex++;
  io.to(code).emit('room_update', publicRoom(r));

  // Check if everyone is eliminated in Battle Royale
  const activePlayers = Object.values(r.players).filter(p => p.connected && !p.eliminated);
  if (r.mode === 'BATTLE_ROYALE' && activePlayers.length === 0) {
    sendQuestion(io, code);
  } else {
    setTimeout(() => sendQuestion(io, code), 2500);
  }
}

const DEFAULT_QUESTIONS: QuizQuestion[] = [
  { id:'dq1', text:'Ibu kota Prancis adalah?', timeLimit:30, answers:[
    {id:'a',text:'London',isCorrect:false},{id:'b',text:'Paris',isCorrect:true},
    {id:'c',text:'Berlin',isCorrect:false},{id:'d',text:'Roma',isCorrect:false}]},
  { id:'dq2', text:'Berapa hasil dari 12 × 12?', timeLimit:30, answers:[
    {id:'a',text:'124',isCorrect:false},{id:'b',text:'144',isCorrect:true},
    {id:'c',text:'134',isCorrect:false},{id:'d',text:'148',isCorrect:false}]},
  { id:'dq3', text:'Planet terdekat dengan Matahari?', timeLimit:30, answers:[
    {id:'a',text:'Venus',isCorrect:false},{id:'b',text:'Bumi',isCorrect:false},
    {id:'c',text:'Merkurius',isCorrect:true},{id:'d',text:'Mars',isCorrect:false}]},
  { id:'dq4', text:'Simbol kimia untuk Emas?', timeLimit:30, answers:[
    {id:'a',text:'Au',isCorrect:true},{id:'b',text:'Ag',isCorrect:false},
    {id:'c',text:'Fe',isCorrect:false},{id:'d',text:'Gd',isCorrect:false}]},
  { id:'dq5', text:'Siapa penemu telepon?', timeLimit:30, answers:[
    {id:'a',text:'Edison',isCorrect:false},{id:'b',text:'Tesla',isCorrect:false},
    {id:'c',text:'Alexander Bell',isCorrect:true},{id:'d',text:'Faraday',isCorrect:false}]},
];

/* ── Main handler ── */
export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`[+] ${socket.id}`);

    /* Teacher creates room with quiz */
    socket.on('create_room', async ({ questions, quizId, mode }: { questions?: QuizQuestion[]; quizId?: string; mode?: 'BOSS_BATTLE' | 'BATTLE_ROYALE' | 'TEAM_BATTLE' }) => {
      let code = '';
      const qs   = questions && questions.length > 0 ? questions : DEFAULT_QUESTIONS;
      const resolvedMode = mode || 'BOSS_BATTLE';
      const resolvedQuizId = quizId && !quizId.startsWith('sample-') ? quizId : 'sample-1';

      let maxPlayers = 50; // FREE Tier default limit
      try {
        if (resolvedQuizId !== 'sample-1') {
          const quiz = await prisma.quiz.findUnique({
            where: { id: resolvedQuizId },
            include: { creator: true }
          });
          if (quiz) {
            code = quiz.roomCode || genCode();
            if (((quiz.creator as any).subscriptionTier === 'PREMIUM' || (quiz.creator as any).subscriptionTier === 'ENTERPRISE')) {
              maxPlayers = 400; // PREMIUM/ENTERPRISE Tier limit
            }
          } else {
            code = genCode();
          }
        } else {
          code = 'DEMO12';
        }

        // ✅ FIX: Jika room sudah ada di memory (misal sisa deploy lama), bersihkan timer
        // dan buat ulang dengan state WAITING yang bersih.
        if (rooms.has(code)) {
          clearTimer(code);
          clearTickTimer(code);
          console.log(`[Room ${code}] Re-deploying — resetting existing room to WAITING.`);
        }

        rooms.set(code, {
          hostId: socket.id, bossHp: 500 * qs.length, maxBossHp: 500 * qs.length,
          players: {}, spectators: new Set(), status: 'WAITING',
          currentQuestionIndex: 0, questions: qs,
          answeredThisRound: new Set(), wrongThisRound: 0, cheatingLog: [],
          mode: resolvedMode,
          redScore: resolvedMode === 'TEAM_BATTLE' ? 0 : undefined,
          blueScore: resolvedMode === 'TEAM_BATTLE' ? 0 : undefined,
          maxPlayers,
          socketToPlayer: {},
        });

        socket.join(code);
        socket.emit('room_created', { roomCode: code, maxPlayers });
        console.log(`[Room ${code}] created in ${resolvedMode} mode (${qs.length} questions, max: ${maxPlayers})`);

        // Skip DB persist untuk demo room — tidak ada quiz valid di database
        if (resolvedQuizId !== 'sample-1') {
          await prisma.room.upsert({
            where: { code },
            update: {
              status: 'WAITING',
              mode: resolvedMode,
              quizId: resolvedQuizId,
            },
            create: {
              code,
              quizId: resolvedQuizId,
              status: 'WAITING',
              mode: resolvedMode,
            },
          });
          console.log(`[RoomDB ${code}] Persisted to database.`);
        } else {
          console.log(`[Room ${code}] Demo room — skipping DB persist.`);
        }
      } catch (err) {
        console.error(`[RoomDB ${code}] Error saving room to DB:`, err);
        socket.emit('error', { message: 'Gagal membuat room. Coba lagi.' });
      }
    });

    /* Player joins room */
    socket.on('join_room', async ({ roomCode, playerName, mode }: { roomCode: string; playerName: string; mode?: string }) => {
      const code = roomCode?.trim().toUpperCase();
      const name = playerName?.trim().slice(0, 24);
      if (!code || !name) { socket.emit('error', { message: 'Data tidak valid.' }); return; }

      // ✅ FIX: Jika room tidak ada di memory, coba restore dari database (e.g. setelah server restart)
      if (!rooms.has(code)) {
        try {
          const dbRoom = await prisma.room.findUnique({
            where: { code },
            include: { quiz: { include: { questions: { include: { answers: true } } } } }
          });

          if (dbRoom && dbRoom.status === 'WAITING' && dbRoom.quiz) {
            // Rebuild room di memory dari data DB
            const qs: QuizQuestion[] = dbRoom.quiz.questions.map((q: any) => ({
              id: q.id, text: q.text, timeLimit: q.timeLimit,
              answers: q.answers.map((a: any) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect }))
            }));
            const resolvedMode = (dbRoom.mode || 'BOSS_BATTLE') as 'BOSS_BATTLE' | 'BATTLE_ROYALE' | 'TEAM_BATTLE';
            rooms.set(code, {
              hostId: '', bossHp: 500 * qs.length, maxBossHp: 500 * qs.length,
              players: {}, spectators: new Set(), status: 'WAITING',
              currentQuestionIndex: 0, questions: qs,
              answeredThisRound: new Set(), wrongThisRound: 0, cheatingLog: [],
              mode: resolvedMode,
              redScore: resolvedMode === 'TEAM_BATTLE' ? 0 : undefined,
              blueScore: resolvedMode === 'TEAM_BATTLE' ? 0 : undefined,
              maxPlayers: 50,
              socketToPlayer: {},
            });
            console.log(`[Room ${code}] Auto-restored from DB for player ${name}`);
          } else {
            socket.emit('error', { message: `Room "${code}" tidak ditemukan. Minta guru untuk deploy ulang.` });
            return;
          }
        } catch (err) {
          console.error(`[Room ${code}] Error restoring from DB:`, err);
          socket.emit('error', { message: `Room "${code}" tidak ditemukan.` });
          return;
        }
      }

      const r = rooms.get(code)!;
      
      if (mode && r.mode !== mode) {
        socket.emit('error', { message: `Mode tidak cocok! Room ini menggunakan mode ${r.mode.replace('_', ' ')}.` });
        return;
      }

      if (Object.keys(r.players).length >= r.maxPlayers && !r.socketToPlayer[socket.id]) {
        // Also check if they are just reconnecting
        const checkPid = name.toLowerCase().trim();
        if (!r.players[checkPid]) {
          socket.emit('error', { message: `Room penuh! (Batas: ${r.maxPlayers} pemain). Minta host untuk upgrade ke Premium.` });
          return;
        }
      }

      socket.join(code);

      const playerId = name.toLowerCase().trim();
      r.socketToPlayer[socket.id] = playerId;

      if (r.players[playerId]) {
        // RECONNECT / SESSION RESURRECTION
        r.players[playerId].connected = true;
        r.players[playerId].socketId = socket.id;
        console.log(`[Room ${code}] ${name} reconnected (Resurrected Session)`);
      } else {
        // NEW PLAYER
        // Determine team in Team Battle
        let assignedTeam: 'RED' | 'BLUE' | undefined = undefined;
        if (r.mode === 'TEAM_BATTLE') {
          const redCount = Object.values(r.players).filter(p => p.team === 'RED').length;
          const blueCount = Object.values(r.players).filter(p => p.team === 'BLUE').length;
          assignedTeam = redCount <= blueCount ? 'RED' : 'BLUE';
        }

        r.players[playerId] = {
          name, score: 0, combo: 0, maxCombo: 0,
          shield: 500, maxShield: 500,
          correctCount: 0, wrongCount: 0, fastAnswers: 0,
          lives: r.mode === 'BATTLE_ROYALE' ? 3 : undefined,
          eliminated: r.mode === 'BATTLE_ROYALE' ? false : undefined,
          team: assignedTeam,
          connected: true,
          socketId: socket.id,
        };
        console.log(`[Room ${code}] ${name} joined (${Object.keys(r.players).length} players) in team: ${assignedTeam}`);
      }

      io.to(code).emit('room_update', publicRoom(r));
    });

    /* Spectator (teacher) watches without playing */
    socket.on('watch_room', async ({ roomCode }: { roomCode: string }) => {
      const code = roomCode?.trim().toUpperCase();
      if (!rooms.has(code)) {
        // Coba restore dari DB
        try {
          const dbRoom = await prisma.room.findUnique({
            where: { code },
            include: { quiz: { include: { questions: { include: { answers: true } } } } }
          });
          if (dbRoom && dbRoom.quiz) {
            const qs: QuizQuestion[] = dbRoom.quiz.questions.map((q: any) => ({
              id: q.id, text: q.text, timeLimit: q.timeLimit,
              answers: q.answers.map((a: any) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect }))
            }));
            const resolvedMode = (dbRoom.mode || 'BOSS_BATTLE') as 'BOSS_BATTLE' | 'BATTLE_ROYALE' | 'TEAM_BATTLE';
            rooms.set(code, {
              hostId: '', bossHp: 500 * qs.length, maxBossHp: 500 * qs.length,
              players: {}, spectators: new Set(), status: 'WAITING',
              currentQuestionIndex: 0, questions: qs,
              answeredThisRound: new Set(), wrongThisRound: 0, cheatingLog: [],
              mode: resolvedMode,
              redScore: resolvedMode === 'TEAM_BATTLE' ? 0 : undefined,
              blueScore: resolvedMode === 'TEAM_BATTLE' ? 0 : undefined,
              maxPlayers: 50,
              socketToPlayer: {},
            });
          } else {
            socket.emit('error', { message: `Room "${code}" tidak ditemukan.` }); return;
          }
        } catch {
          socket.emit('error', { message: `Room "${code}" tidak ditemukan.` }); return;
        }
      }
      const r = rooms.get(code)!;
      socket.join(code);
      r.spectators.add(socket.id);
      socket.emit('room_update', publicRoom(r));
      socket.emit('spectator_joined', { roomCode: code });
      console.log(`[Room ${code}] Spectator joined: ${socket.id}`);
    });

    /* Start game */
    socket.on('start_game', ({ roomCode }: { roomCode: string }) => {
      const code = roomCode?.trim().toUpperCase();
      const r    = rooms.get(code);
      if (!r || r.status !== 'WAITING') return;
      r.status = 'PLAYING'; r.currentQuestionIndex = 0;

      // Update room status in database
      prisma.room.update({
        where: { code },
        data: { status: 'PLAYING' },
      }).catch(err => console.error('[RoomDB] Error updating start status:', err));
      
      // ✅ Game Design Balance: Dynamic boss HP scaling based on active players!
      // If 1 player, boss HP = 1 * 500 * qs.length = 2500 HP (perfect for 5 correct answers).
      // If 5 players, boss HP = 5 * 500 * qs.length = 12500 HP (team scaling).
      const playerCount = Math.max(1, Object.keys(r.players).length);
      r.maxBossHp = playerCount * 500 * r.questions.length;
      r.bossHp = r.maxBossHp;

      // Optimasi: Gunakan tick timer untuk broadcast update state ke semua player secara berkala (1 detik), bukan setiap kali ada yang submit jawaban.
      clearTickTimer(code);
      tickTimers.set(code, setInterval(() => {
        const roomData = rooms.get(code);
        if (roomData && roomData.status === 'PLAYING') {
          io.to(code).emit('room_update', publicRoom(roomData));
        }
      }, 1000));

      io.to(code).emit('room_update', publicRoom(r));
      sendQuestion(io, code);
      console.log(`[Room ${code}] Game started with dynamically scaled boss HP: ${r.bossHp}`);
    });

    /* Submit answer — server validates */
    socket.on('submit_answer', ({
      roomCode, answerId, timeTaken,
    }: { roomCode: string; answerId: string; timeTaken: number }) => {
      // 🚦 Rate Limiting: Prevent spamming / Auto-Clickers
      if (isRateLimited(socket.id, 500)) {
        return; // Drop if sent faster than 500ms
      }

      const code   = roomCode?.trim().toUpperCase();
      const r      = rooms.get(code);
      if (!r || r.status !== 'PLAYING') return;

      const playerId = r.socketToPlayer[socket.id];
      if (!playerId) return;

      if (r.answeredThisRound.has(playerId)) return;

      const player = r.players[playerId];
      if (!player || player.eliminated || !player.connected) return;
      
      r.answeredThisRound.add(playerId);

      const q        = r.questions[r.currentQuestionIndex];
      const correct  = q?.answers.find(a => a.id === answerId)?.isCorrect ?? false;
      
      // ANTI-CHEAT: Calculate time on server side! Ignore client's timeTaken.
      const serverTimeTaken = (Date.now() - (r.questionStartTime || Date.now())) / 1000;
      const clamped  = Math.min(Math.max(serverTimeTaken, 0), q?.timeLimit ?? 30);
      const isFast   = clamped < 3;

      if (correct) {
        player.combo++;
        player.maxCombo = Math.max(player.maxCombo, player.combo);
        player.correctCount++;
        if (isFast) player.fastAnswers++;
        const speedBonus = Math.max(0, ((q?.timeLimit ?? 30) - clamped) * 10);
        const damage     = Math.max(0, 100 * player.combo + speedBonus);
        player.score   += damage;

        if (r.mode === 'BOSS_BATTLE') {
          r.bossHp = Math.max(0, r.bossHp - damage);
        } else if (r.mode === 'TEAM_BATTLE') {
          if (player.team === 'RED') {
            r.redScore = (r.redScore || 0) + damage;
          } else {
            r.blueScore = (r.blueScore || 0) + damage;
          }
        }

        io.to(code).emit('player_attack', {
          playerId: player.socketId, playerName: player.name,
          damage, bossHp: r.bossHp, isCorrect: true,
        });

        if (r.mode === 'BOSS_BATTLE' && r.bossHp <= 0) advanceQuestion(io, code);
      } else {
        player.combo = 0;
        player.wrongCount++;
        r.wrongThisRound++;

        if (r.mode === 'BATTLE_ROYALE') {
          player.lives = Math.max(0, (player.lives || 3) - 1);
          if (player.lives === 0) {
            player.eliminated = true;
            io.to(code).emit('boss_attack', { damage: 0, message: `${player.name} TERELIMINASI!` });
          }
        }

        io.to(code).emit('player_attack', {
          playerId: player.socketId, playerName: player.name,
          damage: 0, bossHp: r.bossHp, isCorrect: false,
        });
      }

      // Optimasi: Dihapus io.to(code).emit('room_update', publicRoom(r)) untuk mencegah lag N^2. Update state sekarang dihandle oleh interval 1 detik di start_game.

      // All active players answered → advance early
      const activeCount = Object.values(r.players).filter(p => p.connected && !p.eliminated).length;
      if (r.answeredThisRound.size >= activeCount) {
        advanceQuestion(io, code);
      }
    });

    /* Floating emotes */
    socket.on('send_emote', ({ roomCode, emote }: { roomCode: string; emote: string }) => {
      const code = roomCode?.trim().toUpperCase();
      if (!rooms.has(code)) return;
      io.to(code).emit('float_emote', { playerId: socket.id, emote });
    });

    /* Cheating report from client */
    socket.on('report_cheat', ({ roomCode, type }: { roomCode: string; type: string }) => {
      const code = roomCode?.trim().toUpperCase();
      const r    = rooms.get(code);
      const playerId = r?.socketToPlayer[socket.id];
      if (!r || !playerId || !r.players[playerId]) return;
      r.cheatingLog.push({
        socketId: socket.id,
        name: r.players[playerId].name,
        type, time: new Date().toISOString(),
      });
      io.to(code).emit('room_update', publicRoom(r));
      console.log(`[Room ${code}] CHEAT: ${r.players[playerId].name} — ${type}`);
    });

    /* Disconnect */
    socket.on('disconnect', () => {
      rateLimitMap.delete(socket.id); // Clean up rate limit state
      rooms.forEach((r, code) => {
        r.spectators.delete(socket.id);
        const playerId = r.socketToPlayer[socket.id];
        
        if (playerId && r.players[playerId]) {
          r.players[playerId].connected = false;
          delete r.socketToPlayer[socket.id];
          console.log(`[Room ${code}] ${r.players[playerId].name} disconnected`);

          // DYNAMIC BOSS HP: Scale down if someone disconnects permanently during PLAYING
          if (r.status === 'PLAYING' && r.mode === 'BOSS_BATTLE') {
            const activeCount = Object.values(r.players).filter(p => p.connected && !p.eliminated).length;
            const newMax = Math.max(1, activeCount) * 500 * r.questions.length;
            if (newMax < r.maxBossHp) {
              const hpRatio = r.bossHp / r.maxBossHp;
              r.maxBossHp = newMax;
              r.bossHp = Math.max(1, Math.floor(r.maxBossHp * hpRatio));
              console.log(`[Room ${code}] Boss HP dynamically scaled down to ${r.bossHp}/${r.maxBossHp}`);
            }
          }

          io.to(code).emit('room_update', publicRoom(r));
        }

        // Clean up empty room
        const hasActivePlayers = Object.values(r.players).some(p => p.connected);
        if (!hasActivePlayers && r.spectators.size === 0) {
          clearTimer(code); 
          clearTickTimer(code);
          rooms.delete(code);
          console.log(`[Room ${code}] empty — removed`);
        }
      });
      console.log(`[-] ${socket.id}`);
    });
  });
}
