"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getUser, logout, type User } from "@/lib/auth";
import { getProgress } from "@/lib/xp";
import { sound } from "@/lib/sound";
import { motion, AnimatePresence } from "framer-motion";

export default function NavBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,      setUser_]    = useState<User | null>(null);
  const [xp,        setXp]       = useState(0);
  const [level,     setLevel]    = useState(1);
  const [muted,     setMuted]    = useState(false);
  const [menuOpen,  setMenuOpen] = useState(false);

  useEffect(() => {
    setUser_(getUser());
    const p = getProgress();
    setXp(p.xp); setLevel(p.level);
  }, [pathname]);

  const handleLogout = () => {
    logout(); setUser_(null); setMenuOpen(false); router.push("/login");
  };

  const toggleSound = () => {
    const nowMuted = sound.toggle();
    setMuted(nowMuted);
  };

  const navLinks = [
    { href:"/",              label:"Home"           },
    { href:"/practice",      label:"🎯 Practice"    },
    { href:"/leaderboard",   label:"🏆 Ranking"     },
    { href:"/tournaments",   label:"🏅 Turnamen"    },
    { href:"/dashboard",     label:"Dashboard", guardRole:"GURU" },
    { href:"/battle",        label:"⚔️ Play Now",  highlight:true  },
  ];

  return (
    <nav className="border-b border-[#00d4ff]/20 bg-[#050508]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#00d4ff] to-transparent opacity-50" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded border border-[#00d4ff]/50 flex items-center justify-center
              bg-[#00d4ff]/10 shadow-[0_0_10px_rgba(0,212,255,0.3)]">
              <span className="text-sm">🐉</span>
            </div>
            <span className="text-xl font-bold font-['Orbitron'] tracking-wider">
              <span className="text-white">EDU</span><span className="neon-text-cyan">BATTLE</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => {
              if (link.guardRole && user?.role !== link.guardRole) return null;
              const active = pathname === link.href;
              return (
                <Link key={link.href} href={link.href}
                  className={`px-3 py-2 rounded text-sm font-medium transition-all duration-200
                    ${link.highlight
                      ? "ml-1 bg-[#00d4ff] hover:bg-[#33e5ff] text-[#050508] font-bold neon-border-cyan text-xs font-['Orbitron'] tracking-wider"
                      : active
                        ? "text-[#00d4ff] bg-[#00d4ff]/10 border border-[#00d4ff]/30"
                        : "text-[#a8bfd0] hover:text-white hover:bg-white/5"}`}>
                  {link.label}
                </Link>
              );
            })}

            {/* Sound toggle */}
            <button onClick={toggleSound} title={muted ? "Unmute" : "Mute"}
              className="ml-1 p-2 rounded text-[#546e7a] hover:text-[#00d4ff] hover:bg-white/5 transition text-sm">
              {muted ? "🔇" : "🔊"}
            </button>

            {/* User section */}
            {user ? (
              <div className="ml-2 flex items-center gap-2">
                <Link href="/profile" className="glass-panel px-3 py-1.5 flex items-center gap-2
                  hover:border-[#00d4ff]/40 transition border border-[#00d4ff]/15 group">
                  <span className="text-sm">{user.role === "GURU" ? "👨‍🏫" : "🎮"}</span>
                  <div className="text-left">
                    <p className="text-white font-bold text-xs font-['Orbitron'] max-w-[80px] truncate
                      group-hover:text-[#00d4ff] transition">{user.name}</p>
                    <p className="text-[#546e7a] text-[10px]">Lv.{level} • {xp.toLocaleString()} XP</p>
                  </div>
                </Link>
                <button onClick={handleLogout}
                  className="text-xs text-[#546e7a] hover:text-[#ff2a6d] p-1.5 rounded hover:bg-[#ff2a6d]/10 transition">
                  ✕
                </button>
              </div>
            ) : (
              <Link href="/login"
                className="ml-2 px-4 py-2 border border-[#00d4ff]/40 text-[#00d4ff] hover:bg-[#00d4ff]/10
                  rounded text-xs font-bold font-['Orbitron'] tracking-wider transition">
                MASUK
              </Link>
            )}
          </div>

          {/* Mobile */}
          <div className="md:hidden flex items-center gap-2">
            <button onClick={toggleSound} className="p-2 text-[#546e7a] hover:text-[#00d4ff] text-sm">
              {muted ? "🔇" : "🔊"}
            </button>
            <button onClick={() => setMenuOpen(p => !p)} className="p-2 rounded hover:bg-white/5 transition">
              <motion.div animate={{ rotate:menuOpen?45:0, y:menuOpen?8:0 }}
                className="w-5 h-0.5 bg-[#00d4ff] rounded mb-1.5 block" />
              <motion.div animate={{ opacity:menuOpen?0:1 }}
                className="w-5 h-0.5 bg-[#00d4ff] rounded mb-1.5 block" />
              <motion.div animate={{ rotate:menuOpen?-45:0, y:menuOpen?-8:0 }}
                className="w-5 h-0.5 bg-[#00d4ff] rounded block" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
            className="md:hidden overflow-hidden border-t border-[#00d4ff]/10 bg-[#050508]/95">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(link => {
                if (link.guardRole && user?.role !== link.guardRole) return null;
                return (
                  <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                    className={`block px-3 py-2.5 rounded text-sm font-medium transition
                      ${link.highlight
                        ? "bg-[#00d4ff]/15 text-[#00d4ff] font-bold border border-[#00d4ff]/30"
                        : "text-[#a8bfd0] hover:text-white hover:bg-white/5"}`}>
                    {link.label}
                  </Link>
                );
              })}
              <div className="pt-2 border-t border-white/5">
                {user ? (
                  <>
                    <Link href="/profile" onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-[#a8bfd0] hover:text-white hover:bg-white/5 rounded transition">
                      👤 {user.name} (Lv.{level})
                    </Link>
                    <button onClick={handleLogout}
                      className="block w-full text-left px-3 py-2 text-sm text-[#ff2a6d] hover:bg-[#ff2a6d]/10 rounded transition">
                      Keluar
                    </button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-[#00d4ff] font-bold hover:bg-white/5 rounded transition">
                    → Masuk
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
