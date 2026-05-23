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
}

const rooms  = new Map<string, RoomData>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code  = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return rooms.has(code) ? genCode() : code;
}

function clearTimer(code: string) {
  const t = timers.get(code);
  if (t) { clearTimeout(t); timers.delete(code); }
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
    // Update Room status to FINISHED
    const room = await prisma.room.update({
      where: { code },
      data: { status: 'FINISHED' }
    });

    for (const player of results) {
      const email = `${player.name.toLowerCase().replace(/\s+/g, '_')}@siswa.edubattle.local`;
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: player.name,
            role: 'SISWA',
            xp: 0,
            level: 1,
            rank: 'BRONZE'
          }
        });
      }

      const newXP = user.xp + player.xpEarned;
      const newLevel = Math.max(1, Math.floor(Math.sqrt(newXP / 50)));

      const ranks = [
        { name: 'BRONZE', minXP: 0 },
        { name: 'SILVER', minXP: 1000 },
        { name: 'GOLD', minXP: 5000 },
        { name: 'PLATINUM', minXP: 15000 },
        { name: 'MYTHIC', minXP: 50000 },
      ];
      const newRank = [...ranks].reverse().find(r => newXP >= r.minXP)?.name ?? 'BRONZE';

      await prisma.user.update({
        where: { id: user.id },
        data: {
          xp: newXP,
          level: newLevel,
          rank: newRank
        }
      });

      const cheatCount = cheatingLog.filter(c => c.name === player.name).length;

      const session = await prisma.session.create({
        data: {
          userId: user.id,
          roomId: room.id,
          score: player.score,
          combo: player.combo,
        }
      });

      await prisma.analytics.create({
        data: {
          sessionId: session.id,
          correctCount: player.correctCount,
          wrongCount: player.wrongCount,
          avgTime: 0,
          cheatingAttempts: cheatCount
        }
      });

      // --- SERVER-SIDE ACHIEVEMENT VERIFICATION ---
      const achievementsToUnlock: string[] = [];
      if (player.maxCombo >= 10) achievementsToUnlock.push('combo-10');
      if (player.score >= 5000) achievementsToUnlock.push('score-5000');
      if (player.correctCount >= 10 && player.wrongCount === 0) achievementsToUnlock.push('perfect-10');

      for (const achId of achievementsToUnlock) {
        // Ensure achievement exists in DB
        let ach = await prisma.achievement.findFirst({ where: { condition: achId } });
        if (!ach) {
          let title = '', desc = '', icon = '';
          if (achId === 'combo-10') { title = 'Combo Master'; desc = 'Mencapai 10 combo beruntun'; icon = '🔥'; }
          if (achId === 'score-5000') { title = 'High Scorer'; desc = 'Mendapatkan 5000 skor dalam satu game'; icon = '🏆'; }
          if (achId === 'perfect-10') { title = 'Perfectionist'; desc = 'Menjawab 10 benar tanpa salah'; icon = '⭐'; }
          
          ach = await prisma.achievement.create({
            data: { title, description: desc, icon, condition: achId }
          });
        }
        
        // Check if user already has it
        const hasAch = await prisma.userAchievement.findFirst({
          where: { userId: user.id, achievementId: ach.id }
        });
        
        if (!hasAch) {
          await prisma.userAchievement.create({
            data: { userId: user.id, achievementId: ach.id }
          });
          console.log(`[Achievement] ${user.name} unlocked ${achId}!`);
        }
      }

    }
    console.log(`[RoomDB ${code}] Game results persisted successfully.`);
  } catch (err) {
    console.error(`[RoomDB ${code}] Error persisting game results:`, err);
  }
}

function sendQuestion(io: Server, code: string) {
  const r = rooms.get(code);
  if (!r || r.status !== 'PLAYING') return;

  // Filter out eliminated players in Battle Royale
  const activePlayers = Object.entries(r.players).filter(([_, p]) => r.mode !== 'BATTLE_ROYALE' || !p.eliminated);

  if (r.currentQuestionIndex >= r.questions.length || (r.mode === 'BATTLE_ROYALE' && activePlayers.length === 0)) {
    // Game over
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
    Object.entries(r.players).forEach(([sid, p]) => {
      if (!p.eliminated && !r.answeredThisRound.has(sid)) {
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
  const activePlayers = Object.values(r.players).filter(p => !p.eliminated);
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
      const code = genCode();
      const qs   = questions && questions.length > 0 ? questions : DEFAULT_QUESTIONS;
      const resolvedMode = mode || 'BOSS_BATTLE';
      rooms.set(code, {
        hostId: socket.id, bossHp: 500 * qs.length, maxBossHp: 500 * qs.length, // Initial value
        players: {}, spectators: new Set(), status: 'WAITING',
        currentQuestionIndex: 0, questions: qs,
        answeredThisRound: new Set(), wrongThisRound: 0, cheatingLog: [],
        mode: resolvedMode,
        redScore: resolvedMode === 'TEAM_BATTLE' ? 0 : undefined,
        blueScore: resolvedMode === 'TEAM_BATTLE' ? 0 : undefined,
      });
      socket.join(code);
      socket.emit('room_created', { roomCode: code });
      console.log(`[Room ${code}] created in ${resolvedMode} mode (${qs.length} questions)`);

      try {
        const resolvedQuizId = quizId && !quizId.startsWith('sample-') ? quizId : 'sample-1';
        await prisma.room.create({
          data: {
            code,
            quizId: resolvedQuizId,
            status: 'WAITING',
            mode: resolvedMode,
          },
        });
        console.log(`[RoomDB ${code}] Persisted to database.`);
      } catch (err) {
        console.error(`[RoomDB ${code}] Error saving room to DB:`, err);
      }
    });

    /* Player joins room */
    socket.on('join_room', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
      const code = roomCode?.trim().toUpperCase();
      const name = playerName?.trim().slice(0, 24);
      if (!code || !name) { socket.emit('error', { message: 'Data tidak valid.' }); return; }
      if (!rooms.has(code)) { socket.emit('error', { message: `Room "${code}" tidak ditemukan.` }); return; }

      const r = rooms.get(code)!;
      socket.join(code);

      // Determine team in Team Battle
      let assignedTeam: 'RED' | 'BLUE' | undefined = undefined;
      if (r.mode === 'TEAM_BATTLE') {
        const redCount = Object.values(r.players).filter(p => p.team === 'RED').length;
        const blueCount = Object.values(r.players).filter(p => p.team === 'BLUE').length;
        assignedTeam = redCount <= blueCount ? 'RED' : 'BLUE';
      }

      r.players[socket.id] = {
        name, score: 0, combo: 0, maxCombo: 0,
        shield: 500, maxShield: 500,
        correctCount: 0, wrongCount: 0, fastAnswers: 0,
        lives: r.mode === 'BATTLE_ROYALE' ? 3 : undefined,
        eliminated: r.mode === 'BATTLE_ROYALE' ? false : undefined,
        team: assignedTeam,
      };
      io.to(code).emit('room_update', publicRoom(r));
      console.log(`[Room ${code}] ${name} joined (${Object.keys(r.players).length} players) in team: ${assignedTeam}`);
    });

    /* Spectator (teacher) watches without playing */
    socket.on('watch_room', ({ roomCode }: { roomCode: string }) => {
      const code = roomCode?.trim().toUpperCase();
      if (!rooms.has(code)) { socket.emit('error', { message: `Room "${code}" tidak ditemukan.` }); return; }
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

      io.to(code).emit('room_update', publicRoom(r));
      sendQuestion(io, code);
      console.log(`[Room ${code}] Game started with dynamically scaled boss HP: ${r.bossHp}`);
    });

    /* Submit answer — server validates */
    socket.on('submit_answer', ({
      roomCode, answerId, timeTaken,
    }: { roomCode: string; answerId: string; timeTaken: number }) => {
      const code   = roomCode?.trim().toUpperCase();
      const r      = rooms.get(code);
      if (!r || r.status !== 'PLAYING') return;
      if (r.answeredThisRound.has(socket.id)) return;

      const player = r.players[socket.id];
      if (!player || player.eliminated) return;
      
      r.answeredThisRound.add(socket.id);

      const q        = r.questions[r.currentQuestionIndex];
      const correct  = q?.answers.find(a => a.id === answerId)?.isCorrect ?? false;
      const clamped  = Math.min(Math.max(Number(timeTaken) || 0, 0), q?.timeLimit ?? 30);
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
          playerId: socket.id, playerName: player.name,
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
          playerId: socket.id, playerName: player.name,
          damage: 0, bossHp: r.bossHp, isCorrect: false,
        });
      }

      io.to(code).emit('room_update', publicRoom(r));

      // All active players answered → advance early
      const activeCount = Object.values(r.players).filter(p => !p.eliminated).length;
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
      if (!r || !r.players[socket.id]) return;
      r.cheatingLog.push({
        socketId: socket.id,
        name: r.players[socket.id].name,
        type, time: new Date().toISOString(),
      });
      io.to(code).emit('room_update', publicRoom(r));
      console.log(`[Room ${code}] CHEAT: ${r.players[socket.id].name} — ${type}`);
    });

    /* Disconnect */
    socket.on('disconnect', () => {
      rooms.forEach((r, code) => {
        r.spectators.delete(socket.id);
        if (r.players[socket.id]) {
          delete r.players[socket.id];
          io.to(code).emit('room_update', publicRoom(r));
          if (Object.keys(r.players).length === 0 && r.spectators.size === 0) {
            clearTimer(code); rooms.delete(code);
            console.log(`[Room ${code}] empty — removed`);
          }
        }
      });
      console.log(`[-] ${socket.id}`);
    });
  });
}
