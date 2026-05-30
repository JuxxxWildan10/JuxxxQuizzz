"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
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
interface FloatingEmote { id: number; emote: string; x: number; rot: number; }

function BattleInner() {
  const params      = useSearchParams();
  const urlCode     = params.get("code")?.toUpperCase() ?? "";

  const [connected,   setConnected]   = useState(false);
  const [joined,      setJoined]      = useState(false);
  const [playerName,  setPlayerName]  = useState("");
  const [roomCode,    setRoomCode]    = useState(urlCode);
  const [activeCode,  setActiveCode]  = useState(urlCode);
  const [selectedMode, setSelectedMode] = useState<'BOSS_BATTLE' | 'BATTLE_ROYALE' | 'TEAM_BATTLE'>('BOSS_BATTLE');
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
    if (u) {
      setTimeout(() => setPlayerName(u.name), 0);
    }
  }, []);

  useEffect(() => {
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
      const rot = Math.random() * 60 - 30;
      setFloatingEmotes(p => [...p, { id, emote, x, rot }]);
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

    socket.on("error", ({ message }: { message: string }) => {
      setServerErr(message);
      setJoined(false);
    });

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
    setActiveCode(code);
    setServerErr("");
    socket.emit("join_room", { roomCode: code, playerName: name, mode: selectedMode });
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
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated BG */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage:"linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px)", backgroundSize:"60px 60px" }} />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#00d4ff] rounded-full blur-[180px] opacity-5" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#ff2a6d] rounded-full blur-[200px] opacity-5" />
      </div>

      <motion.div initial={{ opacity:0, y:30, scale:0.95 }} animate={{ opacity:1, y:0, scale:1 }} transition={{ duration:0.5, ease:"easeOut" }}
        className="w-full max-w-md relative z-10">

        {/* Header card */}
        <div className="text-center mb-6">
          <motion.div animate={{ y:[0,-8,0] }} transition={{ repeat:Infinity, duration:3, ease:"easeInOut" }} className="inline-block mb-3">
            <div className="w-20 h-20 rounded-2xl border-2 border-[#ff2a6d]/60 flex items-center justify-center bg-black/60 shadow-[0_0_40px_rgba(255,42,109,0.3)] mx-auto">
              <span className="text-4xl">⚔️</span>
            </div>
          </motion.div>
          <h1 className="text-4xl font-bold font-['Orbitron'] tracking-wider" style={{ color:"#00d4ff", textShadow:"0 0 20px rgba(0,212,255,0.5)" }}>BATTLE ARENA</h1>
          <p className="text-[#546e7a] text-sm mt-2 font-['Orbitron'] tracking-widest uppercase text-xs">Masukkan kode dari gurumu</p>
        </div>

        <div className="glass-panel p-6 border border-[#00d4ff]/20 space-y-4">
          {serverErr && (
            <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
              className="text-red-400 text-sm text-center bg-[#ff2a6d]/10 border border-[#ff2a6d]/40 rounded-xl p-3 flex items-center gap-2">
              <span className="text-lg">⚠️</span> {serverErr}
            </motion.div>
          )}

          {/* Room code input */}
          <div>
            <label className="text-[10px] font-bold text-[#00d4ff] uppercase tracking-[0.2em] mb-2 block">🔑 Kode Room</label>
            <input
              className="w-full bg-black/40 border-2 border-[#00d4ff]/30 rounded-xl p-4 text-white uppercase tracking-[0.3em] font-['Orbitron'] font-bold text-lg text-center focus:outline-none focus:border-[#00d4ff] focus:shadow-[0_0_15px_rgba(0,212,255,0.25)] transition-all placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-[#546e7a] placeholder:text-sm"
              placeholder="AB3X9K"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
          </div>

          {/* Player name */}
          <div>
            <label className="text-[10px] font-bold text-[#00d4ff] uppercase tracking-[0.2em] mb-2 block">🎮 Nama Hero</label>
            <input
              className="w-full bg-black/40 border-2 border-[#00d4ff]/30 rounded-xl p-3.5 text-white focus:outline-none focus:border-[#00d4ff] focus:shadow-[0_0_15px_rgba(0,212,255,0.25)] transition-all placeholder:text-[#546e7a]"
              placeholder="Siapa nama legendamu?"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              maxLength={24}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
            />
          </div>

          {/* Mode selector */}
          <div>
            <label className="text-[10px] font-bold text-[#00d4ff] uppercase tracking-[0.2em] mb-2 block">⚔️ Mode Pertempuran</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id:'BOSS_BATTLE',   name:'Boss Battle',   icon:'🐉', desc:'Kalahkan bos', color:'#ff2a6d' },
                { id:'BATTLE_ROYALE', name:'Battle Royale', icon:'👑', desc:'Terakhir berdiri', color:'#f5e642' },
                { id:'TEAM_BATTLE',   name:'Team Battle',   icon:'🛡️', desc:'Kerja sama tim', color:'#00d4ff' },
              ].map(m => (
                <motion.button key={m.id} whileTap={{ scale:0.95 }}
                  onClick={() => setSelectedMode(m.id as 'BOSS_BATTLE'|'BATTLE_ROYALE'|'TEAM_BATTLE')}
                  type="button"
                  className={`p-3 rounded-xl text-center transition-all border-2 ${
                    selectedMode === m.id
                      ? 'border-current bg-white/5'
                      : 'border-white/10 bg-black/30 hover:border-white/20'
                  }`}
                  style={selectedMode === m.id ? { color:m.color, boxShadow:`0 0 15px ${m.color}30` } : { color:'#546e7a' }}>
                  <div className="text-2xl mb-1">{m.icon}</div>
                  <div className="text-[9px] font-bold font-['Orbitron'] leading-tight">{m.name}</div>
                  <div className="text-[8px] opacity-60 mt-0.5">{m.desc}</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Join button */}
          <motion.button
            whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            onClick={handleJoin}
            disabled={!playerName.trim() || !roomCode.trim()}
            className="w-full py-4 rounded-xl font-bold font-['Orbitron'] text-sm tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
            style={{ background:"linear-gradient(135deg, #00d4ff, #0080ff)", color:"#050508", boxShadow:"0 0 25px rgba(0,212,255,0.4)" }}>
            <motion.div className="absolute inset-0 bg-white/10" initial={{ x:"-100%" }} whileHover={{ x:"100%" }} transition={{ duration:0.5 }} />
            ⚔️ MASUK ARENA
          </motion.button>

          {/* Connection status */}
          <div className={`flex items-center justify-center gap-2 text-xs py-2 rounded-lg ${connected ? "text-[#00d4ff] bg-[#00d4ff]/5" : "text-[#f5e642] bg-[#f5e642]/5"}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-[#00d4ff] animate-pulse" : "bg-[#f5e642]"}`} />
            {connected ? "✓ Server Terhubung — Siap Bertarung!" : "⏳ Menghubungkan ke server..."}
          </div>
        </div>

        <div className="text-center mt-4">
          <a href="/login" className="text-xs text-[#546e7a] hover:text-[#00d4ff] transition underline">← Ganti akun</a>
        </div>
      </motion.div>
    </div>
  );

  /* ═══ LOADING ═══ */
  if (!roomData) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:1.2, ease:"linear" }}
          className="w-16 h-16 border-4 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">⚡</div>
      </div>
      <div className="text-center">
        <p className="text-white font-bold font-['Orbitron'] tracking-wider">MEMASUKI ARENA</p>
        <p className="text-[#546e7a] text-xs mt-1">Menghubungkan ke room {activeCode}...</p>
      </div>
    </div>
  );

  /* ═══ GAME OVER ═══ */
  if (gameOver) return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute inset-0 opacity-5 ${gameOver.bossDefeated ? 'bg-[#00d4ff]' : 'bg-[#ff2a6d]'}`} />
        <div className="absolute inset-0" style={{ backgroundImage:"linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px)", backgroundSize:"60px 60px" }} />
      </div>
      <motion.div initial={{ scale:0.85, opacity:0, y:30 }} animate={{ scale:1, opacity:1, y:0 }} transition={{ type:"spring", bounce:0.35 }}
        className="glass-panel p-8 w-full max-w-lg text-center relative z-10" style={{ borderColor: gameOver.bossDefeated ? 'rgba(0,212,255,0.4)' : 'rgba(255,42,109,0.4)' }}>

        <motion.div className="text-8xl mb-4" initial={{ scale:0 }} animate={{ scale:1, rotate:[0,15,-15,0] }} transition={{ delay:0.2, duration:0.6 }}>
          {gameOver.winnerTeam ? "⚔️" : gameOver.bossDefeated ? "🏆" : "💀"}
        </motion.div>

        <motion.h2 initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
          className={`text-4xl font-bold font-['Orbitron'] mb-2 ${
            gameOver.winnerTeam === 'RED' ? "text-red-400"
            : gameOver.winnerTeam === 'BLUE' ? "text-blue-400"
            : gameOver.bossDefeated ? "text-[#00d4ff]"
            : "text-[#ff2a6d]"}`}
          style={{ textShadow:"0 0 25px currentColor" }}>
          {gameOver.winnerTeam ? `TIM ${gameOver.winnerTeam === 'RED' ? 'MERAH 🔴' : 'BIRU 🔵'} MENANG!`
            : gameOver.bossDefeated ? "⚡ VICTORY!"
            : "💀 GAME OVER"}
        </motion.h2>

        <p className="text-[#a8bfd0] mb-5 text-sm">
          {gameOver.winnerTeam ? "Kerjasama luar biasa dari tim pemenang! 🎉"
            : gameOver.bossDefeated ? "Bos telah dikalahkan! Kalian luar biasa! 🎉"
            : "Bos terlalu kuat kali ini... Coba lagi!"}
        </p>

        {xpEarned > 0 && (
          <motion.div initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.5 }}
            className="bg-[#f5e642]/10 border border-[#f5e642]/40 rounded-2xl p-4 mb-5 text-center shadow-[0_0_20px_rgba(245,230,66,0.15)]">
            <span className="text-[10px] text-[#546e7a] uppercase tracking-[0.2em] block mb-1">✨ XP Diperoleh</span>
            <span className="text-3xl font-bold font-['Orbitron'] text-[#f5e642]" style={{ textShadow:"0 0 15px rgba(245,230,66,0.5)" }}>+{xpEarned.toLocaleString()} XP</span>
            {levelUp && <motion.span initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }} className="text-xs text-green-400 block mt-2 font-bold font-['Orbitron'] tracking-widest">🎉 LEVEL UP!</motion.span>}
          </motion.div>
        )}

        <div className="mb-6 space-y-2">
          {gameOver.players.map((p, i) => (
            <motion.div key={p.name} initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.4 + i*0.06 }}
              className={`flex justify-between items-center rounded-xl px-4 py-3 border ${
                i===0 ? "bg-[#f5e642]/8 border-[#f5e642]/30"
                : p.team === 'RED' ? "bg-red-950/20 border-red-500/20"
                : p.team === 'BLUE' ? "bg-blue-950/20 border-blue-500/20"
                : "bg-white/3 border-white/5"}`}>
              <span className="flex items-center gap-3">
                <span className={`text-lg font-bold font-['Orbitron'] w-7 text-center ${
                  i===0?"text-[#f5e642]":i===1?"text-gray-300":i===2?"text-amber-600":"text-[#546e7a]"}`}>
                  {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
                </span>
                <span className="text-white font-bold flex items-center gap-1.5">
                  {p.team === 'RED' ? '🔴' : p.team === 'BLUE' ? '🔵' : ''}{p.name}
                </span>
              </span>
              <span className="font-mono text-[#00d4ff] font-bold text-sm">{p.score.toLocaleString()} <span className="text-[10px] text-[#546e7a]">PTS</span></span>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.96 }} onClick={reset}
            className="px-8 py-3.5 font-bold rounded-xl font-['Orbitron'] text-sm tracking-wider relative overflow-hidden"
            style={{ background:"linear-gradient(135deg, #00d4ff, #0080ff)", color:"#050508", boxShadow:"0 0 25px rgba(0,212,255,0.35)" }}>
            ⚔️ Main Lagi
          </motion.button>
          <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.96 }}
            onClick={() => window.location.href = '/leaderboard'}
            className="px-6 py-3.5 font-bold rounded-xl font-['Orbitron'] text-xs tracking-wider border border-[#f5e642]/40 text-[#f5e642] hover:bg-[#f5e642]/10 transition">
            🏆 Ranking
          </motion.button>
        </div>
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
              animate={{ opacity: 1, y: "-10vh", scale: 1.4, rotate: fe.rot }}
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
            ROOM: {activeCode}
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
              <div className="py-12">
                <div className="text-center">
                  <motion.div animate={{ scale:[1,1.05,1] }} transition={{ repeat:Infinity, duration:2 }}
                    className="inline-flex items-center gap-2 bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-full px-4 py-2 mb-6 shadow-[0_0_15px_rgba(0,212,255,0.2)]">
                    <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
                    <span className="text-[#00d4ff] text-xs font-bold font-['Orbitron'] tracking-wider">MENUNGGU GURU MEMULAI</span>
                  </motion.div>
                  <h3 className="text-3xl text-white font-bold font-['Orbitron'] mb-2">
                    {sorted.length} <span className="text-[#00d4ff]">Warrior</span> Siap
                  </h3>
                  <p className="text-[#a8bfd0] text-sm mb-6 max-w-md mx-auto">
                    Kumpulkan teman-temanmu di room ini. Pertempuran akan segera dimulai saat guru menekan tombol Start.
                  </p>
                  
                  <div className="flex justify-center mt-8">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                      className="w-16 h-16 border-4 border-dashed border-[#ff2a6d]/40 rounded-full flex items-center justify-center">
                      <span className="text-2xl animate-pulse">⚔️</span>
                    </motion.div>
                  </div>
                </div>
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
                    const labels = ["A","B","C","D"];
                    const colors = ["#00d4ff","#f5e642","#ff2a6d","#a855f7"];
                    const isCorrect = ans.id === correctId;
                    const isWrong = ans.id === selectedId && ans.id !== correctId;
                    const isDimmed = (answered || timeLeft===0) && !isCorrect && ans.id !== selectedId;
                    return (
                      <motion.button key={ans.id}
                        whileHover={answered ? {} : { scale:1.03, y:-2 }}
                        whileTap={answered ? {} : { scale:0.97 }}
                        onClick={() => submitAnswer(ans.id)}
                        disabled={answered || timeLeft===0}
                        className={`p-4 rounded-xl border-2 text-left text-sm font-medium transition-all disabled:cursor-not-allowed relative overflow-hidden ${
                          isCorrect ? "border-green-400 bg-green-500/15 text-green-300"
                          : isWrong ? "border-[#ff2a6d] bg-[#ff2a6d]/15 text-[#ff2a6d]"
                          : isDimmed ? "border-white/5 bg-white/3 opacity-30 text-white"
                          : "border-white/10 bg-black/30 text-white hover:border-white/30 hover:bg-white/5"
                        }`}
                        style={isCorrect ? { boxShadow:"0 0 15px rgba(74,222,128,0.3)" } : isWrong ? { boxShadow:"0 0 15px rgba(255,42,109,0.2)" } : undefined}>
                        {/* Shine effect on hover */}
                        {!answered && <motion.div className="absolute inset-0 bg-white/5 -skew-x-12" initial={{ x:"-100%" }} whileHover={{ x:"200%" }} transition={{ duration:0.4 }} />}
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-['Orbitron']"
                            style={{ background:isDimmed ? "rgba(255,255,255,0.05)" : `${colors[i]}20`, color:isDimmed ? "#546e7a" : colors[i], border:`1px solid ${isDimmed ? 'rgba(255,255,255,0.05)' : colors[i]+'40'}` }}>
                            {labels[i]}
                          </span>
                          <span className="pt-0.5 leading-snug">{ans.text}</span>
                        </div>
                        {isCorrect && <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="absolute top-2 right-2 text-green-400 text-lg">✓</motion.div>}
                        {isWrong && <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="absolute top-2 right-2 text-[#ff2a6d] text-lg">×</motion.div>}
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
