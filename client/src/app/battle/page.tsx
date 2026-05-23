"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { socket } from "@/lib/socket";
import { getUser } from "@/lib/auth";
import { sound } from "@/lib/sound";
import { addXP, unlockAchievement, ACHIEVEMENTS, type Achievement } from "@/lib/xp";
import AntiCheatWrapper from "@/components/AntiCheatWrapper";
import AchievementPopup from "@/components/AchievementPopup";

/* ── Types ── */
interface Player {
  name: string; score: number; combo: number;
  shield: number; maxShield: number;
  lives?: number;
  eliminated?: boolean;
  team?: 'RED' | 'BLUE';
}
interface PublicAnswer  { id: string; text: string; }
interface PublicQuestion{ id: string; text: string; answers: PublicAnswer[]; timeLimit: number; }
interface RoomData {
  bossHp: number; maxBossHp: number;
  players: Record<string, Player>;
  status: string; currentQuestionIndex: number; totalQuestions: number;
  mode: 'BOSS_BATTLE' | 'BATTLE_ROYALE' | 'TEAM_BATTLE';
  redScore?: number;
  blueScore?: number;
}
interface AttackPayload { playerId: string; playerName: string; damage: number; bossHp: number; isCorrect: boolean; }
interface DamagePopup   { id: number; value: number; correct: boolean; }
interface FloatingEmote { id: number; emote: string; x: number; }

function BattleInner() {
  const router      = useRouter();
  const params      = useSearchParams();
  const urlCode     = params.get("code")?.toUpperCase() ?? "";

  const [connected,   setConnected]   = useState(false);
  const [joined,      setJoined]      = useState(false);
  const [playerName,  setPlayerName]  = useState("");
  const [roomCode,    setRoomCode]    = useState(urlCode);
  const [roomData,    setRoomData]    = useState<RoomData | null>(null);
  const [question,    setQuestion]    = useState<PublicQuestion | null>(null);
  const [qIndex,      setQIndex]      = useState(0);
  const [qTotal,      setQTotal]      = useState(0);
  const [timeLeft,    setTimeLeft]    = useState(30);
  const [answered,    setAnswered]    = useState(false);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [correctId,   setCorrectId]   = useState<string | null>(null);
  const [gameOver,    setGameOver]    = useState<{ players: (Player & { socketId: string; rank: number; xpEarned: number })[]; bossDefeated: boolean; winnerTeam?: 'RED' | 'BLUE' } | null>(null);
  const [popups,      setPopups]      = useState<DamagePopup[]>([]);
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([]);
  const [bossShake,   setBossShake]   = useState(false);
  const [redFlash,    setRedFlash]    = useState(false);
  const [serverErr,   setServerErr]   = useState("");
  const [achievement, setAchievement] = useState<Achievement | null>(null);
  const [xpEarned,    setXpEarned]    = useState(0);
  const [levelUp,     setLevelUp]     = useState(false);

  const codeRef  = useRef(urlCode);
  const popupId  = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Timer ── */
  const startTimer = useCallback((limit: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(limit);
    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) {
          clearInterval(timerRef.current!);
          sound.play("wrong");
          return 0;
        }
        if (p <= 6) sound.play("tick");
        return p - 1;
      });
    }, 1000);
  }, []);

  /* ── Socket ── */
  useEffect(() => {
    const u = getUser();
    if (u) setPlayerName(u.name);

    socket.connect();
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("room_update", (d: RoomData) => setRoomData(d));

    socket.on("question_start", ({ question: q, index, total }: { question: PublicQuestion; index: number; total: number }) => {
      setQuestion(q); setQIndex(index); setQTotal(total);
      setAnswered(false); setSelectedId(null); setCorrectId(null);
      startTimer(q.timeLimit);
    });

    socket.on("question_end", ({ correctAnswerId }: { correctAnswerId: string }) => {
      setCorrectId(correctAnswerId);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on("player_attack", (d: AttackPayload) => {
      if (d.damage > 0) {
        const id = ++popupId.current;
        setPopups(p => [...p, { id, value: d.damage, correct: d.isCorrect }]);
        setBossShake(true);
        setTimeout(() => setBossShake(false), 400);
        setTimeout(() => setPopups(p => p.filter(x => x.id !== id)), 1200);
        
        if (d.playerId === socket.id) {
          sound.play("correct");
        }
      } else {
        if (d.playerId === socket.id) {
          sound.play("wrong");
        }
      }
    });

    socket.on("boss_attack", ({ damage, message }: { damage: number; message: string }) => {
      sound.play("boss-attack");
      setRedFlash(true);
      setTimeout(() => setRedFlash(false), 800);
      console.log(`[Boss Attack] ${damage} dmg: ${message}`);
    });

    socket.on("float_emote", ({ emote }: { emote: string }) => {
      const id = Math.random();
      const x = 10 + Math.random() * 80;
      setFloatingEmotes(p => [...p, { id, emote, x }]);
      setTimeout(() => {
        setFloatingEmotes(p => p.filter(e => e.id !== id));
      }, 3000);
    });

    socket.on("game_over", (d: { players: (Player & { socketId: string; rank: number; xpEarned: number })[]; bossDefeated: boolean; winnerTeam?: 'RED' | 'BLUE' }) => {
      setGameOver(d);
      if (timerRef.current) clearInterval(timerRef.current);
      
      const me = d.players.find(p => p.name === playerName);
      if (me) {
        sound.play(d.bossDefeated ? "victory" : "wrong");
        setXpEarned(me.xpEarned);
        const { leveledUp } = addXP(me.xpEarned, me.score);
        if (leveledUp) {
          setLevelUp(true);
          sound.play("level-up");
        }

        // Trigger achievements
        if (d.bossDefeated && unlockAchievement("dragon-slayer")) {
          setAchievement(ACHIEVEMENTS.find(a => a.id === "dragon-slayer") ?? null);
          sound.play("achievement");
        }
        if (me.rank === 1 && unlockAchievement("top-1")) {
          setAchievement(ACHIEVEMENTS.find(a => a.id === "top-1") ?? null);
          sound.play("achievement");
        }
      }
    });

    socket.on("error", ({ message }: { message: string }) => setServerErr(message));

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      ["connect","disconnect","room_update","question_start","question_end","player_attack","boss_attack","float_emote","game_over","error"]
        .forEach(ev => socket.off(ev));
      socket.disconnect();
    };
  }, [startTimer, playerName]);

  /* ── Actions ── */
  const handleJoin = () => {
    const name = playerName.trim();
    const code = roomCode.trim().toUpperCase();
    if (!name || !code) return;
    codeRef.current = code;
    setServerErr("");
    socket.emit("join_room", { roomCode: code, playerName: name });
    setJoined(true);
  };

  const handleStart = () => socket.emit("start_game", { roomCode: codeRef.current });

  const submitAnswer = (answerId: string) => {
    if (answered) return;
    setAnswered(true);
    setSelectedId(answerId);
    socket.emit("submit_answer", {
      roomCode: codeRef.current,
      answerId,
      timeTaken: (question?.timeLimit ?? 30) - timeLeft,
    });
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleCheatReport = (type: string) => {
    if (joined && codeRef.current) {
      socket.emit("report_cheat", { roomCode: codeRef.current, type });
    }
  };

  const sendEmote = (emote: string) => {
    if (joined && codeRef.current) {
      socket.emit("send_emote", { roomCode: codeRef.current, emote });
    }
  };

  const reset = () => { setJoined(false); setRoomData(null); setQuestion(null); setGameOver(null); setServerErr(""); setLevelUp(false); };

  /* ═══ JOIN SCREEN ═══ */
  if (!joined) return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      {/* BG grid */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage:"linear-gradient(rgba(0,212,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.025) 1px,transparent 1px)", backgroundSize:"60px 60px" }} />

      <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
        className="glass-panel p-8 w-full max-w-md relative z-10 border border-[#00d4ff]/20">
        <div className="text-center mb-6"><div className="text-5xl mb-2">⚔️</div>
          <h1 className="text-3xl font-bold neon-text-cyan font-['Orbitron'] tracking-wider">BATTLE ARENA</h1>
          <p className="text-[#a8bfd0] text-sm mt-1">Masukkan kode dari guru untuk bergabung</p>
        </div>

        {serverErr && <p className="text-red-400 text-sm mb-4 text-center bg-[#ff2a6d]/10 border border-[#ff2a6d]/30 rounded-lg p-3">{serverErr}</p>}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#00d4ff] uppercase tracking-wider mb-1.5 block">Kode Room</label>
            <input className="w-full bg-[#0d1a2e]/80 border border-[#00d4ff]/30 rounded-lg p-3 text-white uppercase
              tracking-widest font-['Orbitron'] font-bold focus:outline-none focus:border-[#00d4ff] transition placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
              placeholder="Contoh: AB3X9K" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} maxLength={8} />
          </div>
          <div>
            <label className="text-xs font-bold text-[#00d4ff] uppercase tracking-wider mb-1.5 block">Nama Hero</label>
            <input className="w-full bg-[#0d1a2e]/80 border border-[#00d4ff]/30 rounded-lg p-3 text-white
              focus:outline-none focus:border-[#00d4ff] transition"
              placeholder="Nama kamu" value={playerName} onChange={e => setPlayerName(e.target.value)}
              maxLength={24} onKeyDown={e => e.key === "Enter" && handleJoin()} />
          </div>
        </div>

        <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
          onClick={handleJoin} disabled={!playerName.trim() || !roomCode.trim()}
          className="mt-6 w-full py-3 bg-[#00d4ff] hover:bg-[#33e5ff] text-[#050508] font-bold rounded-lg
            neon-border-cyan font-['Orbitron'] text-sm tracking-wider transition">
          MASUK ARENA
        </motion.button>

        <div className={`mt-4 flex items-center justify-center gap-2 text-xs ${connected ? "text-[#00d4ff]" : "text-[#f5e642]"}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-[#00d4ff] animate-pulse" : "bg-[#f5e642]"}`} />
          {connected ? "Server Terhubung" : "Menghubungkan ke server..."}
        </div>
        <div className="mt-4 text-center">
          <a href="/login" className="text-xs text-[#546e7a] hover:text-white underline">← Ganti akun</a>
        </div>
      </motion.div>
    </div>
  );

  /* ═══ LOADING ═══ */
  if (!roomData) return (
    <div className="min-h-screen flex items-center justify-center gap-4">
      <motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:1, ease:"linear" }}
        className="w-10 h-10 border-4 border-[#00d4ff] border-t-transparent rounded-full" />
      <span className="text-white">Memasuki arena...</span>
    </div>
  );

  /* ═══ GAME OVER ═══ */
  if (gameOver) return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <motion.div initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
        className="glass-panel p-8 w-full max-w-lg text-center border border-[#00d4ff]/30">
        <div className="text-6xl mb-4">
          {gameOver.winnerTeam ? "⚔️" : gameOver.bossDefeated ? "🏆" : "💀"}
        </div>
        <h2 className={`text-4xl font-bold font-['Orbitron'] mb-2 
          ${gameOver.winnerTeam === 'RED' ? "text-red-500" 
            : gameOver.winnerTeam === 'BLUE' ? "text-blue-400" 
            : gameOver.bossDefeated ? "text-[#00d4ff]" 
            : "text-[#ff2a6d]"}`}
          style={{ textShadow: "0 0 20px currentColor" }}>
          {gameOver.winnerTeam ? `TIM ${gameOver.winnerTeam === 'RED' ? 'MERAH' : 'BIRU'} MENANG!` 
            : gameOver.bossDefeated ? "VICTORY!" 
            : "GAME OVER"}
        </h2>
        <p className="text-[#a8bfd0] mb-6 text-sm">
          {gameOver.winnerTeam ? "Kerjasama luar biasa dari tim pemenang! 🎉" 
            : gameOver.bossDefeated ? "Bos telah dikalahkan! Luar biasa! 🎉" 
            : "Bos terlalu kuat kali ini..."}
        </p>

        {xpEarned > 0 && (
          <div className="bg-[#f5e642]/10 border border-[#f5e642]/30 rounded-xl p-3 mb-6 text-center">
            <span className="text-xs text-[#546e7a] uppercase tracking-wider block">XP Diperoleh</span>
            <span className="text-2xl font-bold font-['Orbitron'] text-[#f5e642]">+{xpEarned} XP</span>
            {levelUp && <span className="text-xs text-green-400 block mt-1 font-bold">🎉 LEVEL UP!</span>}
          </div>
        )}

        <div className="mb-6 space-y-2">
          {gameOver.players.map((p, i) => (
            <div key={p.name} className={`flex justify-between items-center rounded-lg px-4 py-2 border 
              ${p.team === 'RED' ? "bg-red-950/20 border-red-500/10" 
                : p.team === 'BLUE' ? "bg-blue-950/20 border-blue-500/10" 
                : "bg-[#0d1a2e]/60 border-white/5"}`}>
              <span className="flex items-center gap-2">
                <span className={`font-bold ${i===0?"text-[#f5e642]":i===1?"text-gray-300":"text-amber-600"}`}>#{i+1}</span>
                <span className="text-white font-bold flex items-center gap-1.5">
                  {p.team === 'RED' ? '🔴' : p.team === 'BLUE' ? '🔵' : ''}
                  {p.name}
                </span>
              </span>
              <span className="font-mono text-[#00d4ff] font-bold">{p.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <motion.button whileTap={{ scale:0.96 }} onClick={reset}
          className="px-8 py-3 bg-[#00d4ff] hover:bg-[#33e5ff] text-[#050508] font-bold rounded-lg transition font-['Orbitron']">
          Main Lagi
        </motion.button>
      </motion.div>
      <AchievementPopup achievement={achievement} onDone={() => setAchievement(null)} />
    </div>
  );

  const hp     = (roomData.bossHp / roomData.maxBossHp) * 100;
  const sorted = Object.values(roomData.players).sort((a, b) => b.score - a.score);
  const timePct= question ? (timeLeft / question.timeLimit) * 100 : 100;

  /* ═══ BATTLE SCREEN ═══ */
  return (
    <AntiCheatWrapper onCheatDetected={handleCheatReport}>
      {/* Damage visual pulse */}
      <AnimatePresence>
        {redFlash && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:0.4 }} exit={{ opacity:0 }}
            className="fixed inset-0 bg-[#ff2a6d] pointer-events-none z-50 mix-blend-color-burn" />
        )}
      </AnimatePresence>

      {/* 💥 Highly interactive floating emotes layer! */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        <AnimatePresence>
          {floatingEmotes.map(fe => (
            <motion.div key={fe.id}
              initial={{ opacity: 0, y: "100vh", scale: 0.4 }}
              animate={{ opacity: 1, y: "-10vh", scale: 1.4, rotate: Math.random() * 60 - 30 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.8, ease: "easeOut" }}
              className="absolute text-5xl"
              style={{ left: `${fe.x}%` }}>
              {fe.emote}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="min-h-[calc(100vh-64px)] p-4 flex flex-col items-center max-w-5xl mx-auto relative">
        {/* BG grid */}
        <div className="fixed inset-0 pointer-events-none"
          style={{ backgroundImage:"linear-gradient(rgba(0,212,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.015) 1px,transparent 1px)", backgroundSize:"60px 60px" }} />

        {/* Top bar */}
        <div className="w-full flex justify-between items-center mt-2 mb-3 relative z-10">
          <div className="glass-panel px-3 py-1.5 text-xs font-bold font-['Orbitron'] text-[#00d4ff] border border-[#00d4ff]/20">
            ROOM: {codeRef.current}
          </div>
          {qTotal > 0 && (
            <div className="text-xs text-[#a8bfd0] glass-panel px-3 py-1.5 border border-white/10">
              Soal {qIndex + 1} / {qTotal}
            </div>
          )}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 glass-panel border ${connected?"text-[#00d4ff] border-[#00d4ff]/20":"text-[#ff2a6d] border-[#ff2a6d]/20"}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${connected?"bg-[#00d4ff] animate-pulse":"bg-[#ff2a6d]"}`} />
            {connected ? "Live" : "Offline"}
          </div>
        </div>

        {/* Mode-Specific Score Panel */}
        {roomData.mode === "TEAM_BATTLE" ? (
          <div className="w-full mb-4 relative z-10 grid grid-cols-2 gap-4">
            {/* Red Team */}
            <div className="bg-red-950/40 rounded-xl p-3 border border-red-500/30">
              <div className="flex justify-between items-center mb-1">
                <span className="text-red-400 font-bold font-['Orbitron'] text-sm">🔴 TIM MERAH</span>
                <span className="text-white font-mono font-bold text-sm">{(roomData.redScore || 0).toLocaleString()} PTS</span>
              </div>
              <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-red-500/10">
                <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${Math.min(100, ((roomData.redScore || 0) / Math.max(1, (roomData.redScore || 0) + (roomData.blueScore || 0))) * 100)}%` }} />
              </div>
            </div>
            {/* Blue Team */}
            <div className="bg-blue-950/40 rounded-xl p-3 border border-blue-500/30">
              <div className="flex justify-between items-center mb-1">
                <span className="text-blue-400 font-bold font-['Orbitron'] text-sm">🔵 TIM BIRU</span>
                <span className="text-white font-mono font-bold text-sm">{(roomData.blueScore || 0).toLocaleString()} PTS</span>
              </div>
              <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-blue-500/10">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${Math.min(100, ((roomData.blueScore || 0) / Math.max(1, (roomData.redScore || 0) + (roomData.blueScore || 0))) * 100)}%` }} />
              </div>
            </div>
          </div>
        ) : roomData.mode === "BATTLE_ROYALE" ? (
          <div className="w-full mb-4 relative z-10 glass-panel p-3 border border-[#f5e642]/30 bg-[#f5e642]/5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xl">👑</span>
              <div>
                <h3 className="text-white font-bold font-['Orbitron'] text-sm">BATTLE ROYALE</h3>
                <p className="text-[#a8bfd0] text-xs">Eliminasi langsung — bertahan hidup!</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[#f5e642] font-bold font-['Orbitron'] text-sm">
                🛡️ {Object.values(roomData.players).filter(p => !p.eliminated).length} WARRIOR AKTIF
              </span>
            </div>
          </div>
        ) : (
          /* Standard Boss HP Bar */
          <div className="w-full mb-4 relative z-10">
            <div className="flex justify-between mb-1.5 text-white">
              <h2 className="text-xl font-bold font-['Orbitron'] text-[#ff2a6d]" style={{ textShadow:"0 0 15px rgba(255,42,109,0.4)" }}>
                🐉 CYBER DRAGON
              </h2>
              <span className="font-mono text-[#ff2a6d] text-sm font-bold">{roomData.bossHp.toLocaleString()} / {roomData.maxBossHp.toLocaleString()} HP</span>
            </div>
            <div className="boss-hp-bar-container h-3.5 bg-black/60 border border-[#ff2a6d]/30">
              <motion.div className="boss-hp-bar-fill" animate={{ width:`${hp}%` }} transition={{ type:"spring", bounce:0.2, duration:0.4 }} />
            </div>
          </div>
        )}

        {/* Boss Visual area */}
        <div className="relative flex items-center justify-center my-6 relative z-10">
          <AnimatePresence>
            {popups.map(p => (
              <motion.div key={p.id} initial={{ opacity:1, y:0, scale:1 }} animate={{ opacity:0, y:-80, scale:1.4 }}
                exit={{ opacity:0 }} transition={{ duration:1 }}
                className={`absolute font-bold font-['Orbitron'] text-2xl pointer-events-none z-20 ${p.correct?"text-[#f5e642]":"text-[#546e7a]"}`}
                style={{ textShadow: p.correct?"0 0 12px rgba(245,230,66,0.6)":"none" }}>
                {p.correct ? `-${p.value.toLocaleString()}` : "MISS!"}
              </motion.div>
            ))}
          </AnimatePresence>
          <motion.div
            animate={
              roomData.status === "FINISHED" ? { opacity:0, scale:0 }
              : bossShake ? { x:[-10,10,-10,10,0] }
              : { y:[0,-8,0] }
            }
            transition={
              roomData.status === "FINISHED" ? { duration:0.6 }
              : bossShake ? { duration:0.35 }
              : { repeat:Infinity, duration:2.5, ease:"easeInOut" }
            }
            className="w-40 h-40 rounded-full border-4 border-[#ff2a6d] flex items-center justify-center bg-black/60 shadow-[0_0_40px_rgba(255,42,109,0.35)] relative"
          >
            <span className="text-7xl">🐉</span>
            {bossShake && (
              <div className="absolute inset-0 rounded-full border-4 border-[#ff2a6d]/80 animate-ping" />
            )}
          </motion.div>
        </div>

        {/* Bottom panel */}
        <div className="w-full glass-panel p-5 flex flex-col md:flex-row gap-5 relative z-10 border border-white/10">

          {/* Quiz area */}
          <div className="flex-1 min-w-0">
            {roomData.status === "WAITING" && (
              <div className="text-center py-8">
                <h3 className="text-xl text-white font-bold mb-2 font-['Orbitron']">
                  {sorted.length} Warrior{sorted.length !== 1 ? "s" : ""} Siap
                </h3>
                <p className="text-[#a8bfd0] text-sm mb-6">Menunggu pertempuran dimulai...</p>
                <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                  onClick={handleStart}
                  className="px-8 py-3.5 bg-[#ff2a6d] text-white font-bold rounded-lg neon-border-pink hover:bg-[#ff4d88] transition font-['Orbitron'] text-sm tracking-wider">
                  ⚔️ MULAI BATTLE
                </motion.button>
              </div>
            )}

            {roomData.status === "PLAYING" && question && (
              <div>
                {/* Timer bar */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/10">
                    <motion.div className={`h-full rounded-full transition-colors duration-500
                      ${timeLeft > 15 ? "bg-[#00d4ff]" : timeLeft > 7 ? "bg-[#f5e642]" : "bg-[#ff2a6d]"}`}
                      animate={{ width:`${timePct}%` }} transition={{ duration:0.9, ease:"linear" }} />
                  </div>
                  <span className={`font-mono font-bold text-base w-7 text-right
                    ${timeLeft > 15 ? "text-[#00d4ff]" : timeLeft > 7 ? "text-[#f5e642]" : "text-[#ff2a6d]"}`}>
                    {timeLeft}
                  </span>
                </div>
                <h3 className="text-base text-white font-bold mb-4 leading-snug">{question.text}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {question.answers.map((ans, i) => {
                    let cls = "bg-[#0d1a2e]/60 hover:bg-[#0d1a2e] border-white/10 hover:border-[#00d4ff]/50";
                    if (answered || timeLeft === 0) {
                      if (ans.id === correctId)  cls = "bg-green-500/20 border-green-500 text-green-300";
                      else if (ans.id === selectedId) cls = "bg-[#ff2a6d]/20 border-[#ff2a6d] text-[#ff2a6d] opacity-80";
                      else cls = "bg-[#0d1a2e]/30 border-white/5 opacity-40";
                    }
                    return (
                      <motion.button key={ans.id} whileHover={answered ? {} : { scale:1.02 }} whileTap={answered ? {} : { scale:0.97 }}
                        onClick={() => submitAnswer(ans.id)} disabled={answered || timeLeft === 0}
                        className={`text-white p-3.5 rounded-lg border-2 text-left text-sm font-medium transition disabled:cursor-not-allowed ${cls}`}>
                        <span className="text-xs font-bold text-[#00d4ff] mr-2">{["A","B","C","D"][i]}.</span>{ans.text}
                      </motion.button>
                    );
                  })}
                </div>
                {answered && correctId && (
                  <motion.p initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }}
                    className={`mt-3 text-sm font-bold text-center ${selectedId === correctId ? "text-green-400" : "text-[#ff2a6d]"}`}>
                    {selectedId === correctId ? "✅ Benar! +Damage dikirim ke boss!" : "❌ Salah! Combo reset."}
                  </motion.p>
                )}

                {/* 💥 Dynamic quick reaction emote panel */}
                <div className="flex items-center gap-1.5 justify-center mt-6 bg-black/45 p-2 rounded-xl border border-white/5">
                  <span className="text-[10px] text-[#546e7a] font-bold font-['Orbitron'] mr-1 uppercase">Reaksi:</span>
                  {["🔥", "👑", "💀", "💥", "🐉", "👍", "👎"].map(em => (
                    <motion.button key={em} whileHover={{ scale: 1.25 }} whileTap={{ scale: 0.85 }}
                      onClick={() => sendEmote(em)}
                      className="text-2xl hover:bg-white/10 px-2 py-1 rounded-lg transition">
                      {em}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {roomData.status === "FINISHED" && !gameOver && (
              <div className="text-center py-6">
                <motion.h3 animate={{ scale:[1,1.1,1] }} transition={{ repeat:Infinity, duration:1.5 }}
                  className="text-3xl neon-text-cyan font-bold font-['Orbitron'] mb-2">🏆 VICTORY!</motion.h3>
                <p className="text-[#a8bfd0]">Bos berhasil dikalahkan!</p>
              </div>
            )}
          </div>

          {/* Leaderboard side panel */}
          <div className="w-full md:w-56 shrink-0 bg-black/35 rounded-xl p-4 border border-white/5">
            <h4 className="font-bold text-[#00d4ff] mb-3 border-b border-[#00d4ff]/20 pb-2 font-['Orbitron'] text-xs tracking-widest">
              WARRIORS
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <AnimatePresence>
                {sorted.map((p, i) => (
                  <motion.div key={p.name} layout initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
                    className={`border border-white/5 rounded px-2.5 py-2 transition
                      ${p.eliminated ? "bg-red-950/20 border-red-500/10 opacity-60" 
                        : p.team === 'RED' ? "bg-red-950/40 border-red-500/10" 
                        : p.team === 'BLUE' ? "bg-blue-950/40 border-blue-500/10" 
                        : "bg-[#0d1a2e]/50"}`}>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className={`font-bold shrink-0 ${i===0?"text-[#f5e642]":i===1?"text-gray-300":i===2?"text-amber-600":"text-[#00d4ff]"}`}>#{i+1}</span>
                        <span className="truncate text-white font-bold flex items-center gap-1">
                          {p.team === 'RED' ? '🔴' : p.team === 'BLUE' ? '🔵' : ''}
                          {p.name}
                        </span>
                        {p.combo > 1 && <span className="text-[#f5e642] shrink-0 font-bold">{p.combo}×🔥</span>}
                      </span>
                      <span className="font-mono text-[#00d4ff] font-bold shrink-0 ml-1">{p.score.toLocaleString()}</span>
                    </div>

                    {/* Battle Royale Lives vs standard Shield HP Display */}
                    {roomData.mode === "BATTLE_ROYALE" ? (
                      <div className="flex items-center gap-1 mt-1 text-[10px] font-bold font-['Orbitron']">
                        {p.eliminated ? (
                          <span className="text-red-500">💀 ELIMINATED</span>
                        ) : (
                          <span className="text-[#ff2a6d]">
                            {"❤️".repeat(p.lives || 3)}
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Shield bar display */
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1 bg-black/50 rounded-full overflow-hidden border border-white/5">
                          <div className="h-full bg-gradient-to-r from-blue-600 to-[#00d4ff] rounded-full"
                            style={{ width:`${(p.shield/p.maxShield)*100}%` }} />
                        </div>
                        <span className="text-[10px] text-[#00d4ff]" title="Shield HP">🛡️</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {sorted.length === 0 && <p className="text-[#a8bfd0] text-xs text-center py-3">Belum ada warrior...</p>}
            </div>
          </div>
        </div>
      </div>
      <AchievementPopup achievement={achievement} onDone={() => setAchievement(null)} />
    </AntiCheatWrapper>
  );
}

export default function BossBattlePage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-white">Loading...</div></div>}><BattleInner /></Suspense>;
}
