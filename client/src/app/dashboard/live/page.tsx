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
}
interface RoomData {
  bossHp: number; maxBossHp: number;
  players: Record<string, PlayerData>;
  status: string; currentQuestionIndex: number; totalQuestions: number;
  cheatingLog: Array<{ name: string; type: string; time: string }>;
}

function LiveMonitorInner() {
  const router   = useRouter();
  const params   = useSearchParams();
  const roomCode = params.get("code")?.toUpperCase() ?? "";
  const [room,      setRoom]      = useState<RoomData | null>(null);
  const [connected, setConnected] = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    if (u.role !== "GURU") { router.push("/login"); return; }

    if (!roomCode) return;
    socket.connect();
    socket.on("connect",    () => { setConnected(true); socket.emit("watch_room", { roomCode }); });
    socket.on("disconnect", () => setConnected(false));
    socket.on("room_update", (d: RoomData) => setRoom(d));
    socket.on("error",  ({ message }: { message: string }) => setError(message));
    return () => {
      ["connect","disconnect","room_update","error"].forEach(e => socket.off(e));
      socket.disconnect();
    };
  }, [roomCode]);

  const sorted = room ? Object.entries(room.players)
    .sort(([,a],[,b]) => b.score - a.score) : [];

  if (!roomCode) return <p className="text-center text-[#a8bfd0] mt-20">Tidak ada room code. Gunakan /dashboard/live?code=XXXX</p>;

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold font-['Orbitron'] text-white">
            📡 LIVE MONITOR
          </h1>
          <p className="text-[#546e7a] text-sm mt-1">Room: <span className="text-[#00d4ff] font-bold font-['Orbitron']">{roomCode}</span></p>
        </div>
        <div className={`flex items-center gap-2 glass-panel px-3 py-2 text-xs
          ${connected ? "text-[#00d4ff]" : "text-[#f5e642]"}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-[#00d4ff] animate-pulse" : "bg-[#f5e642]"}`} />
          {connected ? "Live" : "Reconnecting..."}
        </div>
      </div>

      {error && <p className="text-[#ff2a6d] text-sm mb-4 glass-panel px-4 py-3 border border-[#ff2a6d]/30">{error}</p>}

      {!room ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-4">
            <motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:1, ease:"linear" }}
              className="w-8 h-8 border-4 border-[#00d4ff] border-t-transparent rounded-full" />
            <span className="text-[#a8bfd0]">Menunggu data room...</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Boss HP + Status */}
          <div className="glass-panel p-5">
            <h3 className="text-sm font-bold text-[#00d4ff] font-['Orbitron'] tracking-wider mb-4">BOSS STATUS</h3>
            <div className="text-center mb-4">
              <span className="text-5xl">{room.status === "FINISHED" ? "💀" : "🐉"}</span>
              <p className={`text-xs mt-2 font-bold font-['Orbitron'] ${
                room.status === "PLAYING" ? "text-[#00d4ff]" : room.status === "FINISHED" ? "text-[#ff2a6d]" : "text-[#f5e642]"
              }`}>{room.status}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#546e7a]">Boss HP</span>
                <span className="text-[#ff2a6d] font-mono font-bold">
                  {room.bossHp.toLocaleString()} / {room.maxBossHp.toLocaleString()}
                </span>
              </div>
              <div className="boss-hp-bar-container h-3">
                <div className="boss-hp-bar-fill" style={{ width:`${(room.bossHp/room.maxBossHp)*100}%` }} />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[#546e7a]">Soal</span>
                <span className="text-white font-bold">
                  {room.currentQuestionIndex} / {room.totalQuestions}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#546e7a]">Warriors</span>
                <span className="text-[#00d4ff] font-bold">{sorted.length}</span>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="glass-panel p-5">
            <h3 className="text-sm font-bold text-[#00d4ff] font-['Orbitron'] tracking-wider mb-4">
              LEADERBOARD LIVE
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <AnimatePresence>
                {sorted.map(([id, p], i) => (
                  <motion.div key={id} layout initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }}
                    className="bg-[#0d1a2e]/60 rounded-lg px-3 py-2 border border-white/5">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold font-['Orbitron'] w-5
                          ${i===0?"text-[#f5e642]":i===1?"text-gray-300":i===2?"text-amber-600":"text-[#546e7a]"}`}>
                          #{i+1}
                        </span>
                        <span className="text-white text-sm font-bold">{p.name}</span>
                        {p.combo > 1 && <span className="text-[#f5e642] text-xs">{p.combo}×🔥</span>}
                      </div>
                      <span className="font-mono text-[#00d4ff] text-sm font-bold">{p.score.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-[#546e7a]">
                      <span className="text-green-400">✓ {p.correctCount}</span>
                      <span className="text-[#ff2a6d]">✗ {p.wrongCount}</span>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex-1 h-1 bg-black/40 rounded-full overflow-hidden">
                          <div className="h-full bg-[#00d4ff] rounded-full"
                            style={{ width:`${(p.shield/p.maxShield)*100}%` }} />
                        </div>
                        <span className="text-[#00d4ff]">🛡️</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {sorted.length === 0 && <p className="text-[#546e7a] text-xs text-center py-6">Belum ada pemain...</p>}
            </div>
          </div>

          {/* Cheating Log */}
          <div className="glass-panel p-5">
            <h3 className="text-sm font-bold text-[#ff2a6d] font-['Orbitron'] tracking-wider mb-4">
              🚨 CHEAT LOG ({room.cheatingLog.length})
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {room.cheatingLog.length === 0 ? (
                <p className="text-green-400 text-xs text-center py-6">✅ Tidak ada kecurangan terdeteksi</p>
              ) : (
                [...room.cheatingLog].reverse().map((log, i) => (
                  <div key={i} className="bg-[#ff2a6d]/5 border border-[#ff2a6d]/20 rounded-lg px-3 py-2">
                    <p className="text-[#ff2a6d] text-xs font-bold">{log.name}</p>
                    <p className="text-[#a8bfd0] text-xs">{log.type}</p>
                    <p className="text-[#546e7a] text-[10px]">
                      {new Date(log.time).toLocaleTimeString("id-ID")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LiveMonitorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
      <LiveMonitorInner />
    </Suspense>
  );
}
