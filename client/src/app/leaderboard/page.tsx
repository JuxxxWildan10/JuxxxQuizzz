"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

interface LeaderboardPlayer {
  rank: number;
  name: string;
  score: number;
  level: number;
  tier: string;
  avatar: string;
  streak: number;
}
const TIER_COLOR: Record<string,string> = {
  MYTHIC:"text-[#ff2a6d]", PLATINUM:"text-[#00d4ff]", GOLD:"text-[#f5e642]",
  SILVER:"text-gray-300",  BRONZE:"text-amber-600",
};
const TIER_ICON: Record<string,string> = {
  MYTHIC:"👑", PLATINUM:"💎", GOLD:"🥇", SILVER:"🥈", BRONZE:"🥉",
};

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL TIME");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`${SOCKET_URL}/api/leaderboard`);
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data || []);
          return;
        }
      } catch (err) {
        console.error("Gagal memuat papan peringkat:", err);
      }
      setLeaderboard([]);
    }
    loadData().finally(() => setLoading(false));
  }, []);
  return (
    <div className="min-h-[calc(100vh-64px)] p-4 md:p-8 max-w-4xl mx-auto relative">
      {/* BG grid */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage:"linear-gradient(rgba(0,212,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.025) 1px,transparent 1px)", backgroundSize:"60px 60px" }} />

      <div className="relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl
            border border-[#f5e642]/40 bg-[#f5e642]/10 mb-4 shadow-[0_0_20px_rgba(245,230,66,0.2)]">
            <span className="text-3xl">🏆</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-['Orbitron'] tracking-wider">
            GLOBAL <span className="neon-text-cyan">RANKING</span>
          </h1>
          <p className="text-[#546e7a] mt-2 text-sm">Para warrior terbaik EduBattle</p>
        </motion.div>

        {/* Period tabs */}
        <div className="flex justify-center gap-2 mb-8">
          {["ALL TIME","BULANAN","MINGGUAN"].map((p) => (
            <button key={p} onClick={() => setActiveTab(p)}
              className={`px-4 py-2 rounded text-xs font-bold font-['Orbitron'] tracking-wider transition border
                ${activeTab === p
                  ? "bg-[#00d4ff] text-[#050508] border-[#00d4ff] neon-border-cyan"
                  : "bg-transparent text-[#546e7a] border-[#00d4ff]/20 hover:border-[#00d4ff]/50 hover:text-[#00d4ff]"}`}>
              {p}
            </button>
          ))}
        </div>

        {activeTab !== "ALL TIME" ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel text-center py-16 border border-white/10">
            <div className="text-5xl mb-3">⏳</div>
            <h3 className="text-white font-bold font-['Orbitron'] mb-2">Mengumpulkan Data...</h3>
            <p className="text-[#546e7a] text-sm max-w-sm mx-auto">
              Belum cukup data historis untuk menampilkan peringkat {activeTab.toLowerCase()}. Terus mainkan *battle* untuk mencatat sejarah barumu!
            </p>
          </motion.div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:1, ease:"linear" }}
              className="w-12 h-12 border-4 border-[#00d4ff] border-t-transparent rounded-full" />
            <p className="text-[#a8bfd0] text-sm font-['Orbitron']">Memuat peringkat global...</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {leaderboard.length >= 3 && (
              <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
                className="flex justify-center items-end gap-4 mb-8">
                {[leaderboard[1], leaderboard[0], leaderboard[2]].map((p, i) => {
                  const heights  = ["h-28","h-36","h-24"];
                  const labels   = [2, 1, 3];
                  const borders  = ["border-gray-300","border-[#f5e642]","border-amber-600"];
                  const glows    = [
                    "shadow-[0_0_12px_rgba(209,213,219,0.2)]",
                    "shadow-[0_0_25px_rgba(245,230,66,0.5)]",
                    "shadow-[0_0_12px_rgba(217,119,6,0.2)]",
                  ];
                  const topGlow  = ["","neon-text-pink",""];
                  return (
                    <motion.div key={p.name}
                      initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15+i*0.08 }}
                      className="flex flex-col items-center gap-2 flex-1 max-w-[140px]">
                      <span className="text-3xl">{p.avatar}</span>
                      <p className={`text-white text-sm font-bold text-center truncate w-full px-1 ${topGlow[i]}`}>{p.name}</p>
                      <p className="text-[#00d4ff] font-mono text-xs">{p.score.toLocaleString()}</p>
                      <div className={`w-full ${heights[i]} ${borders[i]} border-t-2 rounded-t-lg flex items-center
                        justify-center bg-gradient-to-b from-white/5 to-black/30 ${glows[i]}`}>
                        <span className="text-2xl font-bold text-white font-['Orbitron']">#{labels[i]}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Full list */}
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3 }}
              className="glass-panel overflow-hidden">
              <div className="grid grid-cols-[auto,1fr,auto,auto] gap-x-4 px-5 py-3 border-b border-[#00d4ff]/10
                text-[10px] font-bold text-[#546e7a] uppercase tracking-widest font-['Orbitron']">
                <span>#</span><span>Warrior</span><span className="hidden sm:block">Tier</span><span>Score</span>
              </div>
              
              {leaderboard.length === 0 ? (
                <div className="text-center py-12 text-[#546e7a] text-sm">
                  Belum ada warrior di papan peringkat. Mulai battle untuk menjadi yang pertama!
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {leaderboard.map((p, i) => (
                    <motion.div key={p.name + p.rank}
                      initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.05*i }}
                      className="grid grid-cols-[auto,1fr,auto,auto] gap-x-4 px-5 py-3.5 items-center
                        hover:bg-[#00d4ff]/5 transition">
                      <span className={`font-bold font-['Orbitron'] text-sm w-6 text-center
                        ${i===0?"text-[#f5e642]":i===1?"text-gray-300":i===2?"text-amber-600":"text-[#546e7a]"}`}>
                        {p.rank}
                      </span>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">{p.avatar}</span>
                        <div className="min-w-0">
                          <p className="text-white font-bold text-sm truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-[#546e7a]">Lv.{p.level}</span>
                            {p.streak > 0 && <span className="text-[10px] text-[#f5e642]">🔥 {p.streak}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-1">
                        <span className="text-sm">{TIER_ICON[p.tier] || "🛡️"}</span>
                        <span className={`text-[10px] font-bold font-['Orbitron'] ${TIER_COLOR[p.tier] || "text-gray-300"}`}>{p.tier}</span>
                      </div>
                      <span className="font-mono text-[#00d4ff] font-bold text-sm">{p.score.toLocaleString()}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}

        {/* CTA */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
          className="text-center mt-8">
          <p className="text-[#546e7a] text-sm mb-4">Masuk leaderboard — mulai battle sekarang!</p>
          <Link href="/battle">
            <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
              className="px-8 py-3 bg-[#00d4ff] hover:bg-[#33e5ff] text-[#050508] font-bold rounded-lg
                neon-border-cyan transition font-['Orbitron'] text-sm tracking-wider">
              ⚔️ MULAI BATTLE
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
