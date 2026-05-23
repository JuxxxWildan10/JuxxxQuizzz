"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { getUser, logout, verifyToken, type User } from "@/lib/auth";
import {
  getProgress, xpToNextLevel, xpProgress, getRank,
  ACHIEVEMENTS, type UserProgress,
} from "@/lib/xp";

const RANK_COLOR: Record<string, string> = {
  MYTHIC:"text-[#ff2a6d]", PLATINUM:"text-[#00d4ff]",
  GOLD:"text-[#f5e642]",   SILVER:"text-gray-300", BRONZE:"text-amber-600",
};
const RANK_ICON: Record<string, string> = {
  MYTHIC:"👑", PLATINUM:"💎", GOLD:"🥇", SILVER:"🥈", BRONZE:"🥉",
};

export default function ProfilePage() {
  const router = useRouter();
  const [user,     setUser_]    = useState<User | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    verifyToken().then(u => {
      if (u) {
        setUser_(u);
      } else {
        router.push("/login");
      }
    });
    setProgress(getProgress());
  }, [router]);

  if (!user || !progress) return null;

  const rank     = getRank(progress.xp);
  const nextLvl  = xpToNextLevel(progress.level);
  const xpPct    = xpProgress(progress.xp);
  const userAchievements = user.achievements || progress.achievements;
  const unlocked = ACHIEVEMENTS.filter(a => userAchievements.includes(a.id));
  const locked   = ACHIEVEMENTS.filter(a => !userAchievements.includes(a.id));

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 md:p-8 max-w-4xl mx-auto">
      {/* BG grid */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage:"linear-gradient(rgba(0,212,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.025) 1px,transparent 1px)", backgroundSize:"60px 60px" }} />

      <div className="relative z-10 space-y-6">
        {/* Profile Card */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }}
          className="glass-panel p-6 flex flex-col sm:flex-row items-center gap-6 border border-[#00d4ff]/20">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full border-4 border-[#00d4ff]/50 flex items-center justify-center
            bg-[#0d1a2e] shadow-[0_0_25px_rgba(0,212,255,0.3)] text-5xl shrink-0">
            {user.role === "GURU" ? "👨‍🏫" : "🎮"}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold font-['Orbitron'] text-white tracking-wider">{user.name}</h1>
            <div className="flex items-center gap-2 justify-center sm:justify-start mt-1">
              <span>{RANK_ICON[rank]}</span>
              <span className={`font-bold font-['Orbitron'] text-sm ${RANK_COLOR[rank]}`}>{rank}</span>
              <span className="text-[#546e7a] text-sm">• Level {progress.level}</span>
            </div>
            {/* XP Bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-[#546e7a] mb-1">
                <span>{progress.xp.toLocaleString()} XP</span>
                <span>Next: {nextLvl.toLocaleString()} XP</span>
              </div>
              <div className="h-2.5 bg-[#0d1a2e] rounded-full overflow-hidden border border-[#00d4ff]/20">
                <motion.div initial={{ width:0 }} animate={{ width:`${xpPct}%` }}
                  transition={{ duration:1, ease:"easeOut" }}
                  className="h-full bg-gradient-to-r from-[#0080ff] to-[#00d4ff] rounded-full
                    shadow-[0_0_8px_rgba(0,212,255,0.5)]" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 text-center">
            <button onClick={() => { logout(); router.push("/login"); }}
              className="px-4 py-2 border border-[#ff2a6d]/40 text-[#ff2a6d] rounded-lg text-xs
                hover:bg-[#ff2a6d]/10 transition font-bold">
              Keluar
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label:"Games Played", value:user.gamesPlayed ?? progress.gamesPlayed, color:"neon-text-cyan"   },
            { label:"Total Score",  value:(user.totalScore ?? progress.totalScore).toLocaleString(), color:"neon-text-pink" },
            { label:"Achievements", value:`${unlocked.length}/${ACHIEVEMENTS.length}`, color:"text-[#f5e642]" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: i*0.08 }} className="glass-panel p-4 text-center">
              <p className={`text-2xl font-bold font-['Orbitron'] ${s.color}`}>{s.value}</p>
              <p className="text-[#546e7a] text-xs mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Achievements */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}
          className="glass-panel p-6">
          <h2 className="text-lg font-bold font-['Orbitron'] text-white tracking-wider mb-5 border-b border-[#00d4ff]/20 pb-3">
            🏅 ACHIEVEMENTS ({unlocked.length}/{ACHIEVEMENTS.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[...unlocked, ...locked].map(a => {
              const isUnlocked = userAchievements.includes(a.id);
              return (
                <div key={a.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition
                    ${isUnlocked
                      ? "border-[#f5e642]/40 bg-[#f5e642]/5"
                      : "border-white/5 bg-[#0d1020] opacity-40"}`}>
                  <span className={`text-2xl ${!isUnlocked && "grayscale"}`}>{a.icon}</span>
                  <div>
                    <p className={`text-sm font-bold ${isUnlocked ? "text-white" : "text-[#546e7a]"}`}>{a.name}</p>
                    <p className="text-xs text-[#546e7a]">{a.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
