"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser, getToken } from "@/lib/auth";

const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

interface QuizStat { id: string; title: string; totalPlays: number; avgAccuracy: number; avgScore: number; }
interface MockSessionStat { name: string; correct: number; wrong: number; avgTime: number; cheating: number; }

/* ── Mini Bar Chart ── */
function BarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <motion.div initial={{ height: 0 }} animate={{ height: `${(v / max) * 100}%` }}
            transition={{ duration: 0.8, delay: i * 0.06, ease: "easeOut" }}
            className="w-full rounded-t-sm relative group min-h-[4px]"
            style={{ background: `${color}80`, borderTop: `2px solid ${color}` }}>
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap border border-white/10 z-10 pointer-events-none">
              {v.toLocaleString()}
            </div>
          </motion.div>
          <span className="text-[9px] text-[#546e7a]">Q{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Donut Chart (CSS-based) ── */
function DonutChart({ value, color, label }: { value: number; color: string; label: string }) {
  const r = 40; const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
          <motion.circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="12"
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold font-mono" style={{ color }}>{value}%</span>
        </div>
      </div>
      <span className="text-xs text-[#546e7a]">{label}</span>
    </div>
  );
}

/* ── Sparkline (activity heatmap row) ── */
function ActivityRow({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#546e7a] w-14 text-right">{label}</span>
      <div className="flex gap-0.5 flex-1">
        {values.map((v, i) => {
          const opacity = v === 0 ? 0.05 : 0.15 + (v / max) * 0.85;
          return (
            <motion.div key={i} title={`${v} game`}
              initial={{ opacity: 0, scale: 0 }} animate={{ opacity, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              className="flex-1 h-4 rounded-sm cursor-default"
              style={{ background: `rgba(0,212,255,${opacity})`, border: "1px solid rgba(0,212,255,0.1)" }} />
          );
        })}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser_] = useState<{ name: string; role: string } | null>(null);
  const [quizStats, setQuizStats] = useState<QuizStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState<string>("all");
  const [exportLoading, setExportLoading] = useState(false);

  // Mock per-question accuracy data
  const questionAccuracy = [88, 72, 45, 91, 33, 78, 56, 65, 82, 40];
  const questionAvgTime  = [8, 14, 22, 6, 28, 11, 19, 15, 9, 25];

  // Mock activity heatmap (last 4 weeks × 7 days)
  const heatmap = [
    [0,3,5,2,0,1,4], [2,0,6,4,1,0,3], [5,4,2,0,7,3,1], [1,2,0,5,3,6,4],
  ];

  // Mock watchlist
  const watchlist: MockSessionStat[] = [
    { name: "Budi Santoso",   correct: 4, wrong: 8, avgTime: 3.2, cheating: 4 },
    { name: "Siti Aminah",    correct: 7, wrong: 5, avgTime: 4.1, cheating: 3 },
    { name: "Rizky Pratama",  correct: 3, wrong: 9, avgTime: 2.8, cheating: 2 },
  ];

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${SERVER_URL}/api/quizzes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setQuizStats(data.map((q: { id: string; title: string; sessions?: unknown[] }) => ({
          id: q.id, title: q.title,
          totalPlays: Math.floor(Math.random() * 80) + 10,
          avgAccuracy: Math.floor(Math.random() * 40) + 55,
          avgScore: Math.floor(Math.random() * 4000) + 2000,
        })));
      }
    } catch { /* use mock */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "GURU") { router.replace("/login"); return; }
    setUser_(u);
    loadStats();
  }, [router, loadStats]);

  const handleExport = (type: "pdf" | "excel") => {
    setExportLoading(true);
    setTimeout(() => {
      alert(`Export ${type.toUpperCase()} sedang diproses... (Fitur aktif di paket Enterprise)`);
      setExportLoading(false);
    }, 1200);
  };

  if (!user) return null;

  // Totals
  const totalPlays    = quizStats.reduce((s, q) => s + q.totalPlays, 0) || 284;
  const avgAccuracy   = quizStats.length ? Math.round(quizStats.reduce((s, q) => s + q.avgAccuracy, 0) / quizStats.length) : 76;
  const avgScore      = quizStats.length ? Math.round(quizStats.reduce((s, q) => s + q.avgScore, 0) / quizStats.length) : 3420;

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 md:p-6 max-w-7xl mx-auto relative">
      {/* BG */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage: "linear-gradient(rgba(168,85,247,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(168,85,247,0.025) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 pb-6 border-b border-white/5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/dashboard" className="text-[#546e7a] hover:text-white text-sm transition">← Dashboard</Link>
              <span className="text-[#546e7a]">/</span>
              <span className="text-white text-sm">Analytics</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-['Orbitron'] text-white flex items-center gap-3">
              ADVANCED ANALYTICS
              <span className="text-[10px] bg-gradient-to-r from-[#a855f7] to-[#d946ef] text-white px-2 py-0.5 rounded font-['Orbitron'] tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.4)]">PRO</span>
            </h1>
            <p className="text-[#546e7a] text-sm mt-1">Performa kelas, tingkat kesulitan soal, dan deteksi kecurangan AI.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => handleExport("pdf")} disabled={exportLoading}
              className="px-4 py-2 border border-white/10 rounded-lg text-sm text-[#a8bfd0] hover:text-white hover:bg-white/5 transition flex items-center gap-2 disabled:opacity-50">
              {exportLoading ? "⏳" : "📄"} Export PDF
            </button>
            <button onClick={() => handleExport("excel")} disabled={exportLoading}
              className="px-4 py-2 bg-[#a855f7] hover:bg-[#b966ff] text-white rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              {exportLoading ? "⏳" : "📊"} Export Excel
            </button>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Sesi Bermain", value: totalPlays.toLocaleString(), icon: "🎮", color: "#00d4ff", sub: "+12% minggu ini" },
            { label: "Akurasi Rata-rata", value: `${avgAccuracy}%`, icon: "🎯", color: "#4ade80", sub: "+4.1% vs minggu lalu" },
            { label: "Avg Skor / Sesi", value: avgScore.toLocaleString(), icon: "⭐", color: "#f5e642", sub: "Per game selesai" },
            { label: "Indikasi Cheat", value: watchlist.length.toString(), icon: "⚠️", color: "#ff2a6d", sub: `${watchlist.filter(w => w.cheating >= 4).length} High Risk` },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-5 border border-white/5 relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-10 group-hover:opacity-20 transition-opacity"
                style={{ background: s.color }} />
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-[10px] text-[#546e7a] font-bold uppercase tracking-widest mb-0.5">{s.label}</p>
              <p className="text-2xl font-bold font-['Orbitron']" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-[#546e7a] mt-1">{s.sub}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mb-5">
          {/* Difficulty Chart */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="lg:col-span-2 glass-panel p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold font-['Orbitron'] text-white tracking-wider">📈 AKURASI PER SOAL</h3>
              {/* Quiz filter */}
              <select value={activeQuiz} onChange={e => setActiveQuiz(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[#a8bfd0] text-xs focus:outline-none focus:border-[#a855f7] transition">
                <option value="all">Semua Kuis</option>
                {quizStats.slice(0, 5).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
            </div>
            <BarChart data={questionAccuracy} color="#00d4ff" />
            <div className="flex justify-center gap-5 mt-4 pt-4 border-t border-white/5 text-xs text-[#a8bfd0]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#00d4ff]" />{'>'} 75% Mudah</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#f5e642]" />50-75% Sedang</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#ff2a6d]" />{'<'} 50% Sulit</span>
            </div>
          </motion.div>

          {/* Donut Charts */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            className="glass-panel p-6 border border-white/10 flex flex-col gap-4">
            <h3 className="text-sm font-bold font-['Orbitron'] text-white tracking-wider">📊 RINGKASAN</h3>
            <div className="flex justify-around flex-wrap gap-4 mt-2">
              <DonutChart value={avgAccuracy} color="#4ade80" label="Akurasi" />
              <DonutChart value={62} color="#00d4ff" label="Win Rate" />
              <DonutChart value={Math.min(100, Math.round((watchlist.length / 30) * 100))} color="#ff2a6d" label="Cheat Rate" />
            </div>
            <div className="mt-auto pt-4 border-t border-white/5 text-center">
              <p className="text-[10px] text-[#546e7a]">Data berdasarkan {totalPlays} sesi terakhir</p>
            </div>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mb-5">
          {/* Activity Heatmap */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="lg:col-span-2 glass-panel p-6 border border-white/10">
            <h3 className="text-sm font-bold font-['Orbitron'] text-white tracking-wider mb-4">🗓️ AKTIVITAS BERMAIN (4 MINGGU)</h3>
            <div className="space-y-2">
              {heatmap.map((week, i) => (
                <ActivityRow key={i} values={week} label={`Mgg ${i + 1}`} />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
              <span className="text-[10px] text-[#546e7a]">Tidak aktif</span>
              {[0.1, 0.3, 0.55, 0.8, 1].map((o, i) => (
                <div key={i} className="w-4 h-4 rounded-sm" style={{ background: `rgba(0,212,255,${o})` }} />
              ))}
              <span className="text-[10px] text-[#546e7a]">Sangat aktif</span>
            </div>
          </motion.div>

          {/* Avg Time per Question */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
            className="glass-panel p-6 border border-white/10">
            <h3 className="text-sm font-bold font-['Orbitron'] text-white tracking-wider mb-4">⏱️ WAKTU RATA-RATA (detik)</h3>
            <div className="space-y-3">
              {questionAvgTime.map((t, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#546e7a]">Soal #{i + 1}</span>
                    <span className={`font-mono font-bold ${t > 20 ? "text-[#ff2a6d]" : t > 12 ? "text-[#f5e642]" : "text-[#4ade80]"}`}>{t}s</span>
                  </div>
                  <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(t / 30) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.05 }}
                      className="h-full rounded-full"
                      style={{ background: t > 20 ? "#ff2a6d" : t > 12 ? "#f5e642" : "#4ade80" }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Cheat Watchlist */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="glass-panel border border-[#ff2a6d]/20 overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-[#ff2a6d] to-transparent" />
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold font-['Orbitron'] text-[#ff2a6d] tracking-wider flex items-center gap-2">
                ⚠️ WATCHLIST KECURANGAN (AI DETECTED)
              </h3>
              <span className="text-[10px] text-[#546e7a] bg-white/5 px-3 py-1 rounded-full border border-white/10">
                {watchlist.length} siswa terdeteksi
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-[#ff2a6d] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] text-[#546e7a] font-bold uppercase tracking-widest">
                      <th className="py-2 px-3 text-left">Siswa</th>
                      <th className="py-2 px-3 text-center">Jawaban Benar</th>
                      <th className="py-2 px-3 text-center">Jawaban Salah</th>
                      <th className="py-2 px-3 text-center">Rata-rata Waktu</th>
                      <th className="py-2 px-3 text-center">Peringatan</th>
                      <th className="py-2 px-3 text-center">Risk Level</th>
                      <th className="py-2 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {watchlist.map((s, i) => {
                      const risk = s.cheating >= 4 ? "HIGH" : s.cheating >= 2 ? "MEDIUM" : "LOW";
                      const riskColor = risk === "HIGH" ? "#ff2a6d" : risk === "MEDIUM" ? "#f5e642" : "#4ade80";
                      return (
                        <motion.tr key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                          className="hover:bg-white/[0.02] transition">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm">🎮</div>
                              <span className="font-bold text-white">{s.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-[#4ade80] font-mono font-bold">{s.correct}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-[#ff2a6d] font-mono font-bold">{s.wrong}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`font-mono font-bold ${s.avgTime < 4 ? "text-[#ff2a6d]" : "text-[#a8bfd0]"}`}>{s.avgTime}s</span>
                            {s.avgTime < 4 && <span className="ml-1 text-[10px] text-[#ff2a6d]">⚡ terlalu cepat</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-bold text-[#ff2a6d]">{s.cheating}×</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-1 rounded text-[10px] font-bold font-['Orbitron']"
                              style={{ background: `${riskColor}15`, color: riskColor, border: `1px solid ${riskColor}40` }}>
                              {risk}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button className="text-xs text-[#a8bfd0] hover:text-white border border-white/10 px-2 py-1 rounded transition hover:bg-white/5">
                              Lihat Detail
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>

        {/* Per-Quiz Table */}
        {quizStats.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="glass-panel border border-white/10 overflow-hidden mt-5">
            <div className="p-5 border-b border-white/5">
              <h3 className="text-sm font-bold font-['Orbitron'] text-white tracking-wider">📚 PERFORMA PER KUIS</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-[#546e7a] font-bold uppercase tracking-widest">
                    <th className="py-3 px-5 text-left">Judul Kuis</th>
                    <th className="py-3 px-4 text-center">Total Sesi</th>
                    <th className="py-3 px-4 text-center">Rata-rata Akurasi</th>
                    <th className="py-3 px-4 text-center">Rata-rata Skor</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {quizStats.map((q, i) => (
                    <motion.tr key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="hover:bg-white/[0.02] transition">
                      <td className="py-3 px-5 font-bold text-white">{q.title}</td>
                      <td className="py-3 px-4 text-center font-mono text-[#a8bfd0]">{q.totalPlays}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${q.avgAccuracy}%`, background: q.avgAccuracy > 75 ? "#4ade80" : q.avgAccuracy > 50 ? "#f5e642" : "#ff2a6d" }} />
                          </div>
                          <span className={`font-mono font-bold text-xs ${q.avgAccuracy > 75 ? "text-[#4ade80]" : q.avgAccuracy > 50 ? "text-[#f5e642]" : "text-[#ff2a6d]"}`}>{q.avgAccuracy}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[#00d4ff] font-bold">{q.avgScore.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${q.avgAccuracy > 75 ? "text-[#4ade80] bg-green-500/10 border border-green-500/20" : "text-[#f5e642] bg-yellow-500/10 border border-yellow-500/20"}`}>
                          {q.avgAccuracy > 75 ? "✓ Baik" : "⚡ Perlu Revisi"}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
