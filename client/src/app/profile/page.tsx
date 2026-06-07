"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { logout, verifyToken, type User } from "@/lib/auth";
import { getProgress, xpToNextLevel, xpProgress, getRank, ACHIEVEMENTS, type UserProgress } from "@/lib/xp";

const RANK_COLOR: Record<string, string> = {
  MYTHIC: "#ff2a6d", PLATINUM: "#00d4ff", GOLD: "#f5e642", SILVER: "#d1d5db", BRONZE: "#b45309",
};
const RANK_GLOW: Record<string, string> = {
  MYTHIC: "0 0 30px rgba(255,42,109,0.5)", PLATINUM: "0 0 30px rgba(0,212,255,0.5)",
  GOLD: "0 0 30px rgba(245,230,66,0.5)", SILVER: "0 0 15px rgba(209,213,219,0.3)",
  BRONZE: "0 0 15px rgba(180,83,9,0.3)",
};
const RANK_ICON: Record<string, string> = {
  MYTHIC: "👑", PLATINUM: "💎", GOLD: "🥇", SILVER: "🥈", BRONZE: "🥉",
};

const avatarList = ["🐉","⚡","🔥","💎","🦁","🐺","🦊","🌙","🌟","🎯","🏆","⚔️"];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser_] = useState<User | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState("🎮");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<"achievements" | "stats">("achievements");

  useEffect(() => {
    verifyToken().then(u => {
      if (u) { setUser_(u); }
      else { router.push("/login"); }
    });
    setTimeout(() => {
      const p = getProgress();
      setProgress(p);
      const saved = localStorage.getItem("edubattle_avatar");
      if (saved) setSelectedAvatar(saved);
    }, 0);
  }, [router]);

  const saveAvatar = (av: string) => {
    setSelectedAvatar(av);
    localStorage.setItem("edubattle_avatar", av);
    setShowAvatarPicker(false);
  };

  if (!user || !progress) return null;

  const rank = getRank(progress.xp);
  const nextLvl = xpToNextLevel(progress.level);
  const xpPct = xpProgress(progress.xp);
  const userAchievements = user.achievements || progress.achievements;
  const unlocked = ACHIEVEMENTS.filter(a => userAchievements.includes(a.id));
  const locked = ACHIEVEMENTS.filter(a => !userAchievements.includes(a.id));
  const rankColor = RANK_COLOR[rank] || "#546e7a";

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 md:p-8 max-w-4xl mx-auto relative">
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(0,212,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.02) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative z-10 space-y-5">
        {/* ── Profile Hero Card ── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 md:p-8 border border-white/10 relative overflow-hidden">
          {/* Rank glow bg */}
          <div className="absolute inset-0 opacity-5 pointer-events-none"
            style={{ background: `radial-gradient(circle at 80% 20%, ${rankColor}, transparent 60%)` }} />

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
            {/* Avatar */}
            <div className="relative shrink-0">
              <motion.div whileHover={{ scale: 1.05 }} onClick={() => setShowAvatarPicker(true)}
                className="w-28 h-28 rounded-2xl flex items-center justify-center text-5xl cursor-pointer border-2 bg-black/40 transition-all"
                style={{ borderColor: rankColor, boxShadow: RANK_GLOW[rank] }}>
                {selectedAvatar}
              </motion.div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#050508] border-2 flex items-center justify-center text-sm cursor-pointer hover:scale-110 transition"
                style={{ borderColor: rankColor }} onClick={() => setShowAvatarPicker(true)}>
                ✏️
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left w-full">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold font-['Orbitron'] text-white">{user.name}</h1>
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold border"
                  style={{ color: rankColor, borderColor: `${rankColor}40`, background: `${rankColor}10` }}>
                  {RANK_ICON[rank]} {rank}
                </span>
              </div>
              <p className="text-[#546e7a] text-sm mb-4">{user.role === "GURU" ? "👨‍🏫 Guru" : "🎮 Warrior"} • Level {progress.level}</p>

              {/* XP Bar */}
              <div>
                <div className="flex justify-between text-xs text-[#546e7a] mb-1.5">
                  <span className="font-mono font-bold text-white">{progress.xp.toLocaleString()} XP</span>
                  <span>Level {progress.level + 1} → {nextLvl.toLocaleString()} XP</span>
                </div>
                <div className="h-3 bg-black/50 rounded-full overflow-hidden border border-white/10 relative">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${xpPct}%` }} transition={{ duration: 1.2, ease: "easeOut" }}
                    className="h-full rounded-full relative" style={{ background: `linear-gradient(90deg, ${rankColor}80, ${rankColor})` }}>
                    <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                  </motion.div>
                </div>
                <p className="text-right text-[10px] text-[#546e7a] mt-1">{xpPct.toFixed(1)}% menuju level {progress.level + 1}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex sm:flex-col gap-2 shrink-0">
              {user.role === "GURU" && (
                <Link href="/dashboard">
                  <button className="px-4 py-2 bg-[#00d4ff]/10 border border-[#00d4ff]/40 text-[#00d4ff] rounded-lg text-xs font-bold hover:bg-[#00d4ff]/20 transition whitespace-nowrap">
                    📊 Dashboard
                  </button>
                </Link>
              )}
              <Link href="/billing">
                <button className="px-4 py-2 border text-xs font-bold rounded-lg transition whitespace-nowrap"
                  style={{ background: `${rankColor}15`, borderColor: `${rankColor}40`, color: rankColor }}>
                  💎 Upgrade PRO
                </button>
              </Link>
              <button onClick={() => { logout(); router.push("/login"); }}
                className="px-4 py-2 border border-[#ff2a6d]/30 text-[#ff2a6d] rounded-lg text-xs font-bold hover:bg-[#ff2a6d]/10 transition">
                Keluar
              </button>
            </div>
          </div>

          {/* Avatar picker popover */}
          {showAvatarPicker && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute top-4 left-4 z-20 bg-[#050508] border border-white/20 rounded-2xl p-4 shadow-2xl">
              <p className="text-[10px] text-[#546e7a] font-bold uppercase tracking-widest mb-3">Pilih Avatar</p>
              <div className="grid grid-cols-6 gap-2">
                {avatarList.map(av => (
                  <button key={av} onClick={() => saveAvatar(av)}
                    className={`w-10 h-10 text-xl rounded-lg hover:bg-white/10 transition flex items-center justify-center ${selectedAvatar === av ? "bg-white/15 ring-2 ring-white/30" : ""}`}>
                    {av}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAvatarPicker(false)} className="mt-3 text-xs text-[#546e7a] hover:text-white w-full text-center">Batal</button>
            </motion.div>
          )}
        </motion.div>

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: "🎮", label: "Games Played", value: user.gamesPlayed ?? progress.gamesPlayed, color: "#00d4ff" },
            { icon: "🏆", label: "Total Score", value: (user.totalScore ?? progress.totalScore).toLocaleString(), color: "#f5e642" },
            { icon: "🏅", label: "Achievements", value: `${unlocked.length}/${ACHIEVEMENTS.length}`, color: "#a855f7" },
            { icon: "🔥", label: "Best Combo", value: "—", color: "#ff2a6d" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="glass-panel p-4 border border-white/5 hover:border-current transition-all"
              style={{ "--tw-text-opacity": 1, color: s.color } as React.CSSProperties}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-2xl font-bold font-['Orbitron']">{s.value}</p>
              <p className="text-[#546e7a] text-xs mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2">
          {(["achievements", "stats"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold font-['Orbitron'] uppercase tracking-wider border transition ${activeTab === tab ? "bg-[#00d4ff] text-[#050508] border-[#00d4ff]" : "border-white/10 text-[#546e7a] hover:text-white hover:border-white/30"}`}>
              {tab === "achievements" ? "🏅 Achievements" : "📈 Statistik"}
            </button>
          ))}
        </div>

        {/* ── Achievements Tab ── */}
        {activeTab === "achievements" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6 border border-white/10">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-sm font-bold font-['Orbitron'] text-white tracking-wider">PENCAPAIAN</h2>
              <span className="text-[10px] text-[#546e7a] bg-white/5 px-3 py-1 rounded-full border border-white/10">
                {unlocked.length} / {ACHIEVEMENTS.length} Terbuka
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/5 mb-6">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(unlocked.length / ACHIEVEMENTS.length) * 100}%` }}
                transition={{ duration: 1 }} className="h-full rounded-full bg-gradient-to-r from-[#a855f7] to-[#d946ef]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...unlocked, ...locked].map(a => {
                const isUnlocked = userAchievements.includes(a.id);
                return (
                  <motion.div key={a.id} whileHover={isUnlocked ? { scale: 1.02 } : {}}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition ${isUnlocked ? "border-[#f5e642]/30 bg-[#f5e642]/5 hover:border-[#f5e642]/50" : "border-white/5 bg-black/20 opacity-40"}`}>
                    <span className={`text-3xl shrink-0 ${!isUnlocked ? "grayscale" : ""}`}>{a.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${isUnlocked ? "text-white" : "text-[#546e7a]"}`}>{a.name}</p>
                      <p className="text-xs text-[#546e7a] truncate">{a.desc}</p>
                    </div>
                    {isUnlocked && <span className="text-[#f5e642] text-lg shrink-0">✓</span>}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Stats Tab ── */}
        {activeTab === "stats" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6 border border-white/10">
            <h2 className="text-sm font-bold font-['Orbitron'] text-white tracking-wider mb-5">STATISTIK PERMAINAN</h2>
            <div className="space-y-4">
              {[
                { label: "Akurasi Rata-rata", value: "76%", bar: 76, color: "#4ade80" },
                { label: "Win Rate Boss Battle", value: "62%", bar: 62, color: "#00d4ff" },
                { label: "Highest Combo", value: "8×", bar: 80, color: "#f5e642" },
                { label: "Kuis Diselesaikan", value: `${user.gamesPlayed ?? progress.gamesPlayed}`, bar: Math.min(100, ((user.gamesPlayed ?? progress.gamesPlayed) / 50) * 100), color: "#a855f7" },
              ].map(s => (
                <div key={s.label}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-[#a8bfd0]">{s.label}</span>
                    <span className="font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
                  </div>
                  <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/5">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${s.bar}%` }} transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full" style={{ background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-xl border border-[#a855f7]/20 bg-[#a855f7]/5 text-center">
              <p className="text-xs text-[#a8bfd0] mb-2">Buka statistik lebih lengkap dengan</p>
              <Link href="/billing">
                <button className="px-4 py-2 text-xs font-bold rounded-lg font-['Orbitron']"
                  style={{ background: "linear-gradient(135deg, #a855f7, #d946ef)", color: "white" }}>
                  💎 Upgrade ke PRO
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
