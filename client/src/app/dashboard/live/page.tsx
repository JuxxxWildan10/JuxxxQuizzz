"use client";

import { useEffect, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { socket } from "@/lib/socket";
import { getUser } from "@/lib/auth";

interface PlayerData {
  name: string; score: number; combo: number;
  shield: number; maxShield: number;
  correctCount: number; wrongCount: number;
  eliminated?: boolean; lives?: number; team?: "RED"|"BLUE";
}
interface RoomData {
  bossHp: number; maxBossHp: number;
  players: Record<string, PlayerData>;
  status: string; currentQuestionIndex: number; totalQuestions: number;
  mode: string;
  cheatingLog: Array<{ name: string; type: string; time: string }>;
  redScore?: number; blueScore?: number;
}

function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold font-['Orbitron']" style={{ color }}>{value}</p>
      <p className="text-[10px] text-[#546e7a] mt-0.5">{label}</p>
    </div>
  );
}

function LiveMonitorInner() {
  const router   = useRouter();
  const params   = useSearchParams();
  const roomCode = params.get("code")?.toUpperCase() ?? "";
  const [room,      setRoom]      = useState<RoomData | null>(null);
  const [connected, setConnected] = useState(false);
  const [error,     setError]     = useState("");
  const [elapsed,   setElapsed]   = useState(0);
  const [startTime] = useState(Date.now());

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "GURU") { router.push("/login"); return; }
    if (!roomCode) return;
    socket.connect();
    socket.on("connect",    () => { setConnected(true); socket.emit("watch_room", { roomCode }); });
    socket.on("disconnect", () => setConnected(false));
    socket.on("room_update", (d: RoomData) => setRoom(d));
    socket.on("error", ({ message }: { message: string }) => setError(message));
    return () => {
      ["connect","disconnect","room_update","error"].forEach(e => socket.off(e));
      socket.disconnect();
    };
  }, [roomCode, router]);

  const sorted     = room ? Object.entries(room.players).sort(([,a],[,b]) => b.score - a.score) : [];
  const totalPlayers = sorted.length;
  const activePlayers = sorted.filter(([,p]) => !p.eliminated).length;
  const avgAccuracy = totalPlayers > 0
    ? Math.round(sorted.reduce((s,[,p]) => s + (p.correctCount/(Math.max(1,(p.correctCount+p.wrongCount))))*100, 0) / totalPlayers)
    : 0;
  const hpPct = room ? (room.bossHp / room.maxBossHp) * 100 : 100;
  const fmtTime = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  if (!roomCode) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-[#a8bfd0]">Tidak ada room code. Gunakan /dashboard/live?code=XXXX</p>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 md:p-6 max-w-7xl mx-auto relative">
      {/* Grid BG */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage:"linear-gradient(rgba(0,212,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.02) 1px,transparent 1px)", backgroundSize:"60px 60px" }} />

      <div className="relative z-10">
        {/* ── Top Bar ── */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl md:text-2xl font-bold font-['Orbitron'] text-white tracking-wider flex items-center gap-2">
                📡 LIVE MONITOR
                {room?.status === "PLAYING" && (
                  <span className="text-[10px] bg-[#ff2a6d] text-white px-2 py-0.5 rounded-full font-['Orbitron'] tracking-widest animate-pulse">● LIVE</span>
                )}
              </h1>
              <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${connected ? "border-[#00d4ff]/40 text-[#00d4ff] bg-[#00d4ff]/5" : "border-[#f5e642]/40 text-[#f5e642] bg-[#f5e642]/5"}`}>
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-[#00d4ff] animate-pulse" : "bg-[#f5e642]"}`} />
                {connected ? "Connected" : "Reconnecting..."}
              </div>
            </div>
            <p className="text-[#546e7a] text-sm">
              Room: <span className="text-[#00d4ff] font-bold font-['Orbitron'] tracking-wider">{roomCode}</span>
              <span className="mx-2 opacity-30">•</span>
              <span className="font-mono text-white">{fmtTime(elapsed)}</span>
              {room && <span className="mx-2 opacity-30">•</span>}
              {room && <span className="text-[#a855f7] font-bold text-xs">{room.mode?.replace("_"," ")}</span>}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {room?.status === "WAITING" && (
              <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.97 }}
                onClick={() => socket.emit("start_game", { roomCode })}
                className="px-6 py-3 rounded-xl font-bold font-['Orbitron'] text-sm tracking-wider relative overflow-hidden"
                style={{ background:"linear-gradient(135deg, #ff2a6d, #ff6b9d)", color:"#fff", boxShadow:"0 0 25px rgba(255,42,109,0.4)" }}>
                <motion.div className="absolute inset-0 bg-white/20" initial={{ x:"-100%" }} whileHover={{ x:"100%" }} transition={{ duration:0.4 }} />
                🚀 MULAI BATTLE
              </motion.button>
            )}
            <button onClick={() => window.print()}
              className="px-4 py-2 border border-white/10 text-sm text-[#a8bfd0] hover:text-white hover:bg-white/5 rounded-lg transition">
              🖨️ Print
            </button>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="mb-4 bg-[#ff2a6d]/10 border border-[#ff2a6d]/30 text-[#ff2a6d] px-4 py-3 rounded-lg text-sm">
            {error}
          </motion.div>
        )}

        {!room ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:1.2, ease:"linear" }}
              className="w-12 h-12 border-4 border-[#00d4ff] border-t-transparent rounded-full" />
            <p className="text-[#a8bfd0]">Menunggu data room <span className="font-['Orbitron'] text-[#00d4ff]">{roomCode}</span>...</p>
          </div>
        ) : (
          <>
            {/* ── KPI Strip ── */}
            <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
              className="glass-panel px-6 py-4 border border-white/10 mb-5 grid grid-cols-2 md:grid-cols-5 gap-4 divide-x divide-white/5">
              <StatBadge label="Warriors" value={`${activePlayers}/${totalPlayers}`} color="#00d4ff" />
              <StatBadge label="Soal" value={`${room.currentQuestionIndex}/${room.totalQuestions}`} color="#f5e642" />
              <StatBadge label="Boss HP" value={`${Math.round(hpPct)}%`} color="#ff2a6d" />
              <StatBadge label="Akurasi Avg" value={`${avgAccuracy}%`} color="#4ade80" />
              <StatBadge label="Cheat Log" value={room.cheatingLog.length} color={room.cheatingLog.length > 0 ? "#ff2a6d" : "#4ade80"} />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* ── Boss / Game Status ── */}
              <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.1 }}
                className="glass-panel p-6 border border-white/10 flex flex-col gap-5">
                <h3 className="text-xs font-bold text-[#00d4ff] font-['Orbitron'] tracking-widest uppercase">Status Arena</h3>

                {/* Boss visual */}
                {room.mode === "BOSS_BATTLE" && (
                  <div className="text-center">
                    <motion.div animate={room.status === "PLAYING" ? { y:[0,-8,0] } : {}} transition={{ repeat:Infinity, duration:3, ease:"easeInOut" }}
                      className="inline-block">
                      <div className="w-20 h-20 mx-auto text-5xl flex items-center justify-center rounded-2xl border border-[#ff2a6d]/30 bg-[#ff2a6d]/5"
                        style={{ boxShadow: hpPct < 30 ? "0 0 30px rgba(255,42,109,0.5)" : "0 0 15px rgba(255,42,109,0.2)" }}>
                        🐉
                      </div>
                    </motion.div>
                    <p className="text-[#ff2a6d] font-bold font-['Orbitron'] text-sm mt-2">CYBER DRAGON</p>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-[#546e7a] mb-1">
                        <span>HP</span>
                        <span className="text-[#ff2a6d] font-mono font-bold">
                          {room.bossHp.toLocaleString()} / {room.maxBossHp.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-3 bg-black/60 rounded-full overflow-hidden border border-[#ff2a6d]/20">
                        <motion.div className="h-full rounded-full"
                          animate={{ width:`${hpPct}%` }} transition={{ type:"spring", bounce:0.2 }}
                          style={{ background: hpPct < 30 ? "linear-gradient(90deg,#ff2a6d,#ff6b9d)" : "linear-gradient(90deg,#ff6b4a,#ff2a6d)", boxShadow:`0 0 8px rgba(255,42,109,0.6)` }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Team Battle Score */}
                {room.mode === "TEAM_BATTLE" && (
                  <div className="space-y-3">
                    {[
                      { label:"Tim Merah 🔴", score: room.redScore||0, color:"#ef4444" },
                      { label:"Tim Biru 🔵",  score: room.blueScore||0, color:"#3b82f6" },
                    ].map(t => (
                      <div key={t.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold" style={{ color:t.color }}>{t.label}</span>
                          <span className="font-mono font-bold text-white">{t.score.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width:`${Math.min(100,t.score/Math.max(1,(room.redScore||0)+(room.blueScore||0))*100)}%`, background:t.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Status badge */}
                <div className="flex items-center justify-center">
                  <span className={`px-4 py-2 rounded-full text-xs font-bold font-['Orbitron'] tracking-widest border ${
                    room.status === "PLAYING"  ? "border-[#4ade80]/40 text-[#4ade80] bg-[#4ade80]/5 animate-pulse" :
                    room.status === "FINISHED" ? "border-[#ff2a6d]/40 text-[#ff2a6d] bg-[#ff2a6d]/5" :
                    "border-[#f5e642]/40 text-[#f5e642] bg-[#f5e642]/5"
                  }`}>
                    {room.status === "PLAYING" ? "● SEDANG BERLANGSUNG" : room.status === "FINISHED" ? "■ SELESAI" : "⏳ MENUNGGU"}
                  </span>
                </div>

                {room.status === "WAITING" && (
                  <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                    onClick={() => socket.emit("start_game", { roomCode })}
                    className="w-full py-3.5 rounded-xl font-bold font-['Orbitron'] text-sm tracking-wider relative overflow-hidden"
                    style={{ background:"linear-gradient(135deg, #ff2a6d, #a855f7)", color:"#fff", boxShadow:"0 0 25px rgba(255,42,109,0.35)" }}>
                    <motion.div className="absolute inset-0 bg-white/15" initial={{ x:"-100%" }} whileHover={{ x:"100%" }} transition={{ duration:0.4 }} />
                    🚀 MULAI SEKARANG
                  </motion.button>
                )}
              </motion.div>

              {/* ── Live Leaderboard ── */}
              <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
                className="glass-panel p-5 border border-white/10 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-[#00d4ff] font-['Orbitron'] tracking-widest uppercase">Live Leaderboard</h3>
                  <span className="text-[10px] text-[#546e7a]">{sorted.length} Warrior</span>
                </div>
                <div className="space-y-2 overflow-y-auto flex-1 max-h-80 pr-1">
                  <AnimatePresence>
                    {sorted.map(([id, p], i) => {
                      const acc = p.correctCount + p.wrongCount > 0
                        ? Math.round((p.correctCount / (p.correctCount + p.wrongCount)) * 100)
                        : 0;
                      return (
                        <motion.div key={id} layout initial={{ opacity:0, x:-10 }} animate={{ opacity:p.eliminated ? 0.4 : 1, x:0 }}
                          className={`rounded-xl px-3 py-2.5 border transition-all ${
                            i === 0 ? "bg-[#f5e642]/5 border-[#f5e642]/30" :
                            p.team === "RED" ? "bg-red-950/30 border-red-500/15" :
                            p.team === "BLUE" ? "bg-blue-950/30 border-blue-500/15" :
                            "bg-black/30 border-white/5"
                          }`}>
                          <div className="flex justify-between items-center mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-xs font-bold font-['Orbitron'] w-5 shrink-0 ${
                                i===0?"text-[#f5e642]":i===1?"text-gray-300":i===2?"text-amber-600":"text-[#546e7a]"
                              }`}>#{i+1}</span>
                              {p.team && <span className="text-xs shrink-0">{p.team === "RED" ? "🔴" : "🔵"}</span>}
                              <span className="text-white text-sm font-bold truncate">{p.name}</span>
                              {p.combo > 1 && <span className="text-[#f5e642] text-xs shrink-0">{p.combo}×🔥</span>}
                              {p.eliminated && <span className="text-[10px] text-[#ff2a6d] font-bold shrink-0">💀</span>}
                            </div>
                            <span className="font-mono text-[#00d4ff] text-sm font-bold shrink-0 ml-2">{p.score.toLocaleString()}</span>
                          </div>
                          {/* Progress bars */}
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div className="text-center">
                              <div className="text-[#4ade80] font-bold">✓{p.correctCount}</div>
                              <div className="h-1 bg-black/40 rounded-full mt-0.5 overflow-hidden">
                                <div className="h-full bg-[#4ade80] rounded-full" style={{ width:`${acc}%` }} />
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-[#ff2a6d] font-bold">✗{p.wrongCount}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-[#00d4ff]">🛡️{Math.round((p.shield/p.maxShield)*100)}%</div>
                              <div className="h-1 bg-black/40 rounded-full mt-0.5 overflow-hidden">
                                <div className="h-full bg-[#00d4ff] rounded-full" style={{ width:`${(p.shield/p.maxShield)*100}%` }} />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {sorted.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-[#546e7a] text-sm">Belum ada warrior...</p>
                      <p className="text-[#546e7a] text-xs mt-1">Bagikan kode <span className="text-[#00d4ff] font-bold">{roomCode}</span> ke siswa</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* ── Cheat Log ── */}
              <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.3 }}
                className="glass-panel p-5 border border-[#ff2a6d]/20 flex flex-col">
                <div className="h-0.5 -mx-5 -mt-5 mb-5 bg-gradient-to-r from-transparent via-[#ff2a6d]/50 to-transparent" />
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-[#ff2a6d] font-['Orbitron'] tracking-widest uppercase">
                    🚨 Anti-Cheat Log
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${room.cheatingLog.length > 0 ? "bg-[#ff2a6d]/15 text-[#ff2a6d] border border-[#ff2a6d]/30" : "bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/20"}`}>
                    {room.cheatingLog.length > 0 ? `${room.cheatingLog.length} Peringatan` : "✓ Bersih"}
                  </span>
                </div>

                <div className="space-y-2 overflow-y-auto flex-1 max-h-80">
                  {room.cheatingLog.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="text-4xl mb-2">🛡️</div>
                      <p className="text-[#4ade80] text-sm font-bold">Tidak ada kecurangan</p>
                      <p className="text-[#546e7a] text-xs mt-1">Semua siswa bermain jujur</p>
                    </div>
                  ) : (
                    [...room.cheatingLog].reverse().map((log, i) => (
                      <motion.div key={i} initial={{ opacity:0, y:-5 }} animate={{ opacity:1, y:0 }}
                        className="bg-[#ff2a6d]/5 border border-[#ff2a6d]/20 rounded-lg px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[#ff2a6d] text-xs font-bold truncate">⚠ {log.name}</p>
                            <p className="text-[#a8bfd0] text-[11px] mt-0.5">{log.type}</p>
                          </div>
                          <p className="text-[#546e7a] text-[10px] font-mono shrink-0">
                            {new Date(log.time).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Quick actions */}
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                  <button className="w-full py-2 text-xs border border-white/10 text-[#a8bfd0] hover:text-white hover:bg-white/5 rounded-lg transition">
                    📋 Export Laporan Kecurangan
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LiveMonitorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-['Orbitron'] text-sm">Loading Monitor...</p>
        </div>
      </div>
    }>
      <LiveMonitorInner />
    </Suspense>
  );
}
