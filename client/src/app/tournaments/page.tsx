"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getUser, getToken, type User } from "@/lib/auth";

const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

interface TournamentEntry {
  id: string;
  userId: string;
  score: number;
  user: { name: string; level: number; rank: string };
}

interface Tournament {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  entries: TournamentEntry[];
}

function getStatusInfo(t: Tournament) {
  const now = new Date();
  const start = new Date(t.startDate);
  const end = new Date(t.endDate);
  if (now < start) return { label: "UPCOMING", color: "text-[#f5e642]", border: "border-[#f5e642]/40", bg: "bg-[#f5e642]/5", icon: "⏳" };
  if (now > end)   return { label: "SELESAI",  color: "text-[#546e7a]", border: "border-white/10",    bg: "bg-white/3",    icon: "🏁" };
  return               { label: "AKTIF",   color: "text-green-400",  border: "border-green-500/40", bg: "bg-green-500/5",  icon: "🔴" };
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TournamentsPage() {
  const [user,           setUser_]          = useState<User | null>(null);
  const [tournaments,    setTournaments]    = useState<Tournament[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [joining,        setJoining]        = useState<string | null>(null);
  const [joinMsg,        setJoinMsg]        = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [showCreate,     setShowCreate]     = useState(false);
  const [creating,       setCreating]       = useState(false);
  const [newTitle,       setNewTitle]       = useState("");
  const [newDesc,        setNewDesc]        = useState("");
  const [newStart,       setNewStart]       = useState("");
  const [newEnd,         setNewEnd]         = useState("");

  const loadTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/tournaments`);
      if (!res.ok) throw new Error("Gagal memuat turnamen");
      const data = await res.json();
      setTournaments(data);
    } catch (err: unknown) {
      setError((err as Error).message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUser_(getUser());
    setTimeout(() => loadTournaments(), 0);
  }, [loadTournaments]);

  const handleJoin = async (tournament: Tournament) => {
    if (!user) { setError("Login terlebih dahulu."); return; }
    const now = new Date();
    if (now < new Date(tournament.startDate) || now > new Date(tournament.endDate)) {
      setJoinMsg({ id: tournament.id, msg: "Turnamen tidak aktif saat ini.", ok: false });
      return;
    }
    setJoining(tournament.id);
    try {
      const token = getToken() || "";
      const res = await fetch(`${SERVER_URL}/api/tournaments/${tournament.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ score: 0 }), // Score is submitted after practice
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal bergabung");
      setJoinMsg({ id: tournament.id, msg: "✅ Berhasil terdaftar! Mainkan sesi practice untuk meningkatkan skor.", ok: true });
      loadTournaments();
    } catch (err: unknown) {
      setJoinMsg({ id: tournament.id, msg: `❌ ${(err as Error).message}`, ok: false });
    } finally {
      setJoining(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim() || !newStart || !newEnd) {
      setError("Semua field wajib diisi."); return;
    }
    setCreating(true);
    try {
      const token = getToken() || "";
      const res = await fetch(`${SERVER_URL}/api/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle, description: newDesc, startDate: newStart, endDate: newEnd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat turnamen");
      setShowCreate(false);
      setNewTitle(""); setNewDesc(""); setNewStart(""); setNewEnd("");
      setError("");
      loadTournaments();
    } catch (err: unknown) {
      setError((err as Error).message || "Terjadi kesalahan");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 md:p-8">
      {/* Grid BG */}
      <div className="fixed inset-0 pointer-events-none -z-10"
        style={{ backgroundImage: "linear-gradient(rgba(0,212,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.018) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold font-['Orbitron'] tracking-wider">
                <span className="text-[#f5e642]" style={{ textShadow: "0 0 20px rgba(245,230,66,0.5)" }}>🏅 TURNAMEN</span>
              </h1>
              <p className="text-[#a8bfd0] text-sm mt-1">Ikuti kompetisi terjadwal dan rebut puncak leaderboard global!</p>
            </div>
            {user?.role === "GURU" && (
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 bg-[#f5e642] text-[#050508] font-bold rounded-lg font-['Orbitron'] text-xs tracking-wider hover:bg-[#ffe94d] transition shadow-[0_0_20px_rgba(245,230,66,0.3)]">
                ➕ BUAT TURNAMEN
              </motion.button>
            )}
          </div>
        </motion.div>

        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-red-400 text-sm mb-6 bg-[#ff2a6d]/10 border border-[#ff2a6d]/30 rounded-lg p-3">
            {error}
          </motion.p>
        )}

        {/* Tournament list */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-8 h-8 border-4 border-[#f5e642] border-t-transparent rounded-full" />
            <span className="text-[#a8bfd0]">Memuat turnamen...</span>
          </div>
        ) : tournaments.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel text-center py-16 border border-white/10">
            <div className="text-5xl mb-3">🏆</div>
            <h3 className="text-white font-bold font-['Orbitron'] mb-2">Belum Ada Turnamen</h3>
            <p className="text-[#546e7a] text-sm">
              {user?.role === "GURU" ? "Klik ➕ BUAT TURNAMEN untuk memulai kompetisi!" : "Tunggu guru untuk membuat turnamen pertama!"}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-5">
            {tournaments.map((t, idx) => {
              const status = getStatusInfo(t);
              const myEntry = t.entries.find(e => e.user?.name === user?.name);
              const top3 = [...t.entries].sort((a, b) => b.score - a.score).slice(0, 5);
              const isActive = status.label === "AKTIF";

              return (
                <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`glass-panel p-6 border ${status.border} ${status.bg} relative overflow-hidden`}>

                  {/* Glow accent */}
                  {isActive && (
                    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-green-500/10 blur-2xl pointer-events-none" />
                  )}

                  <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-['Orbitron'] tracking-widest border ${status.color} ${status.border} bg-black/30`}>
                          {status.icon} {status.label}
                        </span>
                        {myEntry && <span className="text-[10px] text-green-400 font-bold font-['Orbitron'] px-2 py-0.5 bg-green-500/10 border border-green-500/30 rounded">✅ TERDAFTAR</span>}
                      </div>
                      <h3 className="text-white font-bold text-xl font-['Orbitron'] leading-tight mb-1">{t.title}</h3>
                      <p className="text-[#a8bfd0] text-sm">{t.description}</p>
                    </div>

                    {isActive && user?.role !== "GURU" && (
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => handleJoin(t)}
                        disabled={joining === t.id}
                        className="px-5 py-2.5 bg-green-500 hover:bg-green-400 text-white font-bold rounded-lg font-['Orbitron'] text-xs tracking-wider transition disabled:opacity-60 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                        {joining === t.id ? "⏳..." : myEntry ? "🔄 UPDATE SKOR" : "🏅 DAFTAR"}
                      </motion.button>
                    )}
                  </div>

                  {/* Join feedback */}
                  <AnimatePresence>
                    {joinMsg?.id === t.id && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className={`text-xs mb-3 px-3 py-2 rounded border ${joinMsg.ok ? "text-green-400 bg-green-500/10 border-green-500/30" : "text-red-400 bg-red-500/10 border-red-500/30"}`}>
                        {joinMsg.msg}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Date range */}
                  <div className="flex items-center gap-4 text-xs text-[#546e7a] mb-4 flex-wrap">
                    <span>📅 Mulai: <strong className="text-[#a8bfd0]">{formatDate(t.startDate)}</strong></span>
                    <span>🏁 Selesai: <strong className="text-[#a8bfd0]">{formatDate(t.endDate)}</strong></span>
                    <span>👥 <strong className="text-[#a8bfd0]">{t.entries.length}</strong> peserta</span>
                  </div>

                  {/* Mini leaderboard */}
                  {top3.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold font-['Orbitron'] text-[#546e7a] tracking-widest uppercase mb-2">
                        🏆 TOP PESERTA
                      </h4>
                      <div className="space-y-1.5">
                        {top3.map((entry, i) => (
                          <div key={entry.id} className={`flex justify-between items-center px-3 py-1.5 rounded border text-xs
                            ${i === 0 ? "bg-[#f5e642]/10 border-[#f5e642]/30" : i === 1 ? "bg-gray-400/5 border-white/10" : "bg-white/3 border-white/5"}`}>
                            <span className="flex items-center gap-2">
                              <span className={`font-bold font-['Orbitron'] ${i === 0 ? "text-[#f5e642]" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-[#546e7a]"}`}>
                                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                              </span>
                              <span className="text-white font-bold">{entry.user?.name ?? "Unknown"}</span>
                              <span className="text-[#546e7a]">Lv.{entry.user?.level}</span>
                            </span>
                            <span className="font-mono text-[#00d4ff] font-bold">{entry.score.toLocaleString()} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ CREATE TOURNAMENT MODAL ═══ */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-md p-7 relative border border-[#f5e642]/30">

              <button onClick={() => setShowCreate(false)}
                className="absolute top-4 right-4 text-[#546e7a] hover:text-white text-lg transition">✕</button>

              <h2 className="text-xl font-bold font-['Orbitron'] text-[#f5e642] mb-1">🏅 BUAT TURNAMEN</h2>
              <p className="text-[#546e7a] text-xs mb-6">Buat event kompetisi terjadwal untuk para siswa</p>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#a8bfd0] uppercase tracking-wider mb-1.5 block">Judul Turnamen</label>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    className="w-full bg-[#0d1a2e]/80 border border-[#f5e642]/20 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-[#f5e642] transition placeholder:text-[#546e7a]"
                    placeholder="Contoh: Turnamen Matematika Semester 2" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#a8bfd0] uppercase tracking-wider mb-1.5 block">Deskripsi</label>
                  <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3}
                    className="w-full bg-[#0d1a2e]/80 border border-[#f5e642]/20 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-[#f5e642] transition placeholder:text-[#546e7a] resize-none"
                    placeholder="Jelaskan tujuan dan aturan turnamen..." required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[#a8bfd0] uppercase tracking-wider mb-1.5 block">Tanggal Mulai</label>
                    <input type="datetime-local" value={newStart} onChange={e => setNewStart(e.target.value)}
                      className="w-full bg-[#0d1a2e]/80 border border-[#f5e642]/20 rounded-lg p-3 text-white text-xs focus:outline-none focus:border-[#f5e642] transition" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#a8bfd0] uppercase tracking-wider mb-1.5 block">Tanggal Selesai</label>
                    <input type="datetime-local" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                      className="w-full bg-[#0d1a2e]/80 border border-[#f5e642]/20 rounded-lg p-3 text-white text-xs focus:outline-none focus:border-[#f5e642] transition" required />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 rounded-lg border border-white/10 text-[#a8bfd0] hover:text-white hover:border-white/30 transition text-sm font-bold">
                    Batal
                  </button>
                  <motion.button type="submit" whileTap={{ scale: 0.97 }} disabled={creating}
                    className="flex-1 py-2.5 bg-[#f5e642] hover:bg-[#ffe94d] text-[#050508] font-bold rounded-lg transition font-['Orbitron'] text-xs tracking-wider disabled:opacity-60">
                    {creating ? "⏳ Membuat..." : "✅ BUAT"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
