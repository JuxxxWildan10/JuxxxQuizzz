"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getUser, logout, getToken } from "@/lib/auth";
import {
  getQuizzes, saveQuiz, deleteQuiz, uid,
  type Quiz, type QuizQuestion, type QuizAnswer,
} from "@/lib/quizStore";
import { socket } from "@/lib/socket";
import ShareModal from "@/components/ShareModal";

function blankAnswer(): QuizAnswer { return { id: uid(), text: "", isCorrect: false }; }
function blankQuestion(): QuizQuestion {
  return { id: uid(), text: "", timeLimit: 30,
    answers: [blankAnswer(), blankAnswer(), blankAnswer(), blankAnswer()] };
}
function blankQuiz(): Quiz {
  return { id: uid(), title: "", createdAt: new Date().toISOString(), mode: 'BOSS_BATTLE', questions: [blankQuestion()] };
}

export default function DashboardPage() {
  const router = useRouter();
  const [user,          setUser_]         = useState<{ name: string; role: string } | null>(null);
  const [quizzes,       setQuizzes]       = useState<Quiz[]>([]);
  const [editing,       setEditing]       = useState<Quiz | null>(null);
  const [connected,     setConnected]     = useState(false);
  const [deploying,     setDeploying]     = useState<string | null>(null);
  const [deployedId,    setDeployedId]    = useState("");
  const [lastCode,      setLastCode]      = useState("");
  const [error,         setError]         = useState("");
  const [shareRoomCode, setShareRoomCode] = useState<string | null>(null);
  const [aiGenerating,  setAiGenerating]  = useState(false);
  const [aiTopic,       setAiTopic]       = useState("");
  const [aiCount,       setAiCount]       = useState(5);
  const [showAiModal,   setShowAiModal]   = useState(false);

  const refresh = useCallback(async () => {
    try {
      const qs = await getQuizzes();
      setQuizzes(qs);
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("akses ditolak") || err.message?.toLowerCase().includes("token")) {
        logout();
        router.replace("/login");
        return;
      }
      setError(err.message || "Gagal memuat kuis.");
    }
  }, [router]);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "GURU") { 
      router.replace("/login"); 
      return; 
    }
    setTimeout(() => {
      setUser_(u);
      refresh();
    }, 0);

    socket.connect();
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("room_created", ({ roomCode }: { roomCode: string }) => {
      setDeploying(null);
      setLastCode(roomCode);
      setShareRoomCode(roomCode); // Auto-open share modal on deploy
    });
    socket.on("error", ({ message }: { message: string }) => { setError(message); setDeploying(null); });
    return () => {
      socket.off("connect"); socket.off("disconnect");
      socket.off("room_created"); socket.off("error");
      socket.disconnect();
    };
  }, [router, refresh]);

  const deployQuiz = (quiz: Quiz) => {
    if (!connected) { setError("Server belum terhubung."); return; }
    setDeploying(quiz.id); setDeployedId(quiz.id); setLastCode("");
    socket.emit("create_room", { questions: quiz.questions, quizId: quiz.id, mode: quiz.mode });
  };

  const saveEditing = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { setError("Judul kuis wajib diisi!"); return; }
    for (const q of editing.questions) {
      if (!q.text.trim()) { setError("Teks soal tidak boleh kosong!"); return; }
      if (!q.answers.some(a => a.isCorrect)) { setError("Setiap soal harus memiliki satu jawaban benar!"); return; }
    }
    try {
      await saveQuiz(editing);
      await refresh();
      setEditing(null);
      setError("");
    } catch (err: unknown) {
      setError((err as Error).message || "Gagal menyimpan kuis.");
    }
  };

  const updateQ = (qi: number, patch: Partial<QuizQuestion>) => {
    if (!editing) return;
    const qs = [...editing.questions]; qs[qi] = { ...qs[qi], ...patch };
    setEditing({ ...editing, questions: qs });
  };

  const updateA = (qi: number, ai: number, patch: Partial<QuizAnswer>) => {
    if (!editing) return;
    const qs = [...editing.questions];
    const as = [...qs[qi].answers];
    if (patch.isCorrect) as.forEach(a => (a.isCorrect = false));
    as[ai] = { ...as[ai], ...patch };
    qs[qi] = { ...qs[qi], answers: as };
    setEditing({ ...editing, questions: qs });
  };

  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) { setError("Topik kuis tidak boleh kosong!"); return; }
    
    setAiGenerating(true);
    setShowAiModal(false);
    setError("");

    try {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
      const token = getToken();
      const res = await fetch(`${socketUrl}/api/ai/generate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ topic: aiTopic.trim(), count: aiCount })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat kuis");
      
      if (data.id) {
        // Quiz already saved to DB by server — just refresh the list and close
        await refresh();
        setEditing(null);
        setError("");
      } else {
        // Fallback (no API key): server returned preview-only data, open editor for user to save manually
        setEditing(prev => {
          const base = prev || blankQuiz();
          return {
            ...base,
            title: data.title || `Kuis AI: ${aiTopic}`,
            questions: data.questions
          };
        });
      }
      setAiTopic(""); // Reset topic field
    } catch (e: unknown) {
      setError((e as Error).message || "Gagal memproses pembuatan kuis AI.");
    } finally {
      setAiGenerating(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 md:p-8 max-w-7xl mx-auto relative">
      {/* BG grid */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage:'linear-gradient(rgba(0,212,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.025) 1px,transparent 1px)', backgroundSize:'60px 60px' }} />

      <div className="relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold font-['Orbitron'] text-white tracking-wider flex items-center gap-3">
              COMMAND <span className="neon-text-pink">CENTER</span>
            </h1>
            <p className="text-[#546e7a] mt-1 text-sm">
              Selamat datang, <b className="text-[#00d4ff]">{user.name}</b>
              <button onClick={() => router.push("/billing")} className="ml-3 text-[10px] bg-gradient-to-r from-[#a855f7] to-[#d946ef] text-white px-2 py-0.5 rounded-full font-bold shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                UPGRADE PRO
              </button>
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className={`flex items-center gap-2 text-xs px-3 py-2 glass-panel
              ${connected ? "text-[#00d4ff]" : "text-[#f5e642]"}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-[#00d4ff] animate-pulse" : "bg-[#f5e642]"}`} />
              {connected ? "Server Online" : "Menghubungkan..."}
            </div>
            
            <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
              onClick={() => router.push("/dashboard/analytics")}
              className="bg-[#1a0b2e] border border-[#a855f7]/50 hover:bg-[#a855f7]/20 text-white px-4 py-2 rounded font-bold text-xs
                transition font-['Orbitron'] tracking-wider shadow-[0_0_10px_rgba(168,85,247,0.2)] flex items-center gap-1.5">
              <span>📊</span> ANALYTICS <span className="text-[9px] text-[#a855f7]">PRO</span>
            </motion.button>

            <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
              onClick={() => setEditing(blankQuiz())}
              className="bg-[#00d4ff] hover:bg-[#33e5ff] text-[#050508] px-4 py-2 rounded font-bold text-xs
                transition font-['Orbitron'] tracking-wider neon-border-cyan">
              + BUAT QUIZ
            </motion.button>
            <button onClick={() => { logout(); router.push("/login"); }}
              className="text-xs text-[#546e7a] hover:text-[#ff2a6d] px-2 py-2 rounded hover:bg-[#ff2a6d]/10 transition">
              Keluar
            </button>
          </div>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="mb-4 bg-[#ff2a6d]/10 border border-[#ff2a6d]/40 text-[#ff2a6d] px-4 py-3 rounded flex justify-between">
              <span>{error}</span>
              <button onClick={() => setError("")} className="ml-4 hover:text-white">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          {[
            { label:"Kuis Tersimpan", value:quizzes.length,                                       icon:"📚", color:"#00d4ff" },
            { label:"Total Bank Soal",value:quizzes.reduce((s,q) => s + q.questions.length, 0),   icon:"📝", color:"#f5e642" },
            { label:"Arena Aktif",    value:lastCode ? 1 : 0,                                      icon:"⚔️", color:"#ff2a6d" },
            { label:"Status Akses",   value:"ADMIN",                                               icon:"🛡️", color:"#a855f7" },
          ].map((c, i) => (
            <motion.div key={c.label} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.08 }}
              whileHover={{ y:-4, scale:1.02 }}
              className="glass-panel p-5 relative overflow-hidden group cursor-default" style={{ borderColor: `${c.color}30` }}>
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: c.color }} />
              <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">{c.icon}</div>
              <p className="text-[#546e7a] text-[10px] font-bold mb-2 uppercase tracking-[0.2em]">{c.label}</p>
              <p className="text-3xl font-bold font-['Orbitron']" style={{ color: c.color, textShadow: `0 0 15px ${c.color}50` }}>{c.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Quiz List */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-bold text-white mb-5 border-b border-[#00d4ff]/20 pb-3 font-['Orbitron'] tracking-wider">
            📚 QUIZ SAYA
          </h2>
          {quizzes.length === 0 ? (
            <p className="text-[#546e7a] text-center py-10">Belum ada kuis. Klik &quot;+ BUAT QUIZ&quot;!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quizzes.map((quiz, i) => (
                <motion.div key={quiz.id} layout initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} transition={{ delay: i*0.05 }}
                  className="flex flex-col justify-between bg-black/40 p-5 rounded-xl border border-white/10
                    hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/5 transition-all group relative overflow-hidden">
                  
                  {/* Active Indicator Bg */}
                  {deployedId === quiz.id && <div className="absolute inset-0 bg-green-500/5 pointer-events-none" />}
                  
                  <div className="mb-4 relative z-10">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-white font-bold text-lg leading-tight group-hover:text-[#00d4ff] transition-colors">{quiz.title}</h4>
                      <span className="text-[9px] text-[#00d4ff] border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-2 py-1 rounded font-bold font-['Orbitron'] whitespace-nowrap ml-3">
                        {quiz.mode?.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-[#546e7a] flex items-center gap-2">
                      <span>📝 {quiz.questions.length} soal</span>
                      <span>•</span>
                      <span>📅 {new Date(quiz.createdAt).toLocaleDateString("id-ID")}</span>
                    </p>
                    <div className="mt-3 p-3 bg-black/50 rounded-lg border border-white/5 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-[#546e7a] font-bold uppercase tracking-widest">KODE ARENA</span>
                        {deployedId === quiz.id ? (
                          <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/50 px-2 py-0.5 rounded font-bold animate-pulse flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> LIVE
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#546e7a]">OFFLINE</span>
                        )}
                      </div>
                      
                      {quiz.roomCode ? (
                        <div className="flex items-center gap-2">
                          <span className="font-['Orbitron'] font-bold text-[#00d4ff] text-lg tracking-[0.2em] mr-auto">
                            {quiz.roomCode}
                          </span>
                          <button onClick={() => setShareRoomCode(quiz.roomCode!)} title="Share Code"
                            className="text-lg hover:scale-110 transition bg-white/5 p-1.5 rounded-lg border border-white/10 hover:border-[#00d4ff]/50">
                            📡
                          </button>
                          <a href={`/dashboard/live?code=${quiz.roomCode}`} target="_blank" title="Live Monitor"
                            className="text-lg hover:scale-110 transition bg-white/5 p-1.5 rounded-lg border border-white/10 hover:border-[#ff2a6d]/50">
                            📊
                          </a>
                          <a href={`/battle?code=${quiz.roomCode}`} target="_blank" title="Masuk Arena"
                            className="text-lg hover:scale-110 transition bg-white/5 p-1.5 rounded-lg border border-white/10 hover:border-[#f5e642]/50">
                            ⚔️
                          </a>
                        </div>
                      ) : (
                        <div className="text-xs text-[#546e7a] italic">Belum pernah di-deploy.</div>
                      )}
                    </div>
                  </div>
                  <div className="mb-4">
                    <span className="text-xs text-[#00d4ff] border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-2 py-1 rounded font-bold font-['Orbitron']">
                      MODE: {quiz.mode?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex gap-2 relative z-10 mt-auto pt-4 border-t border-white/5">
                    <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.95 }} onClick={() => deployQuiz(quiz)}
                      disabled={deploying === quiz.id}
                      className={`flex-1 text-[11px] py-2.5 rounded-lg font-bold border transition-all disabled:opacity-50 font-['Orbitron'] tracking-wider
                        ${deployedId === quiz.id 
                          ? "bg-green-500/10 border-green-500/50 text-green-400 hover:bg-green-500 hover:text-[#050508]" 
                          : "bg-[#00d4ff]/10 border-[#00d4ff]/40 text-[#00d4ff] hover:bg-[#00d4ff] hover:text-[#050508]"}`}>
                      {deploying === quiz.id ? "⏳ DEPLOYING..." : deployedId === quiz.id ? "🔄 RESTART" : "🚀 DEPLOY"}
                    </motion.button>
                    <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }} onClick={() => setEditing({ ...quiz })}
                      className="px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-[#a8bfd0] hover:text-white hover:border-white/30 transition-all">
                      ✏️
                    </motion.button>
                    <motion.button whileHover={{ scale:1.05, backgroundColor:"rgba(255,42,109,0.15)" }} whileTap={{ scale:0.95 }} onClick={async () => {
                      if (confirm(`Yakin hapus kuis "${quiz.title}"?`)) {
                        try {
                          await deleteQuiz(quiz.id);
                          await refresh();
                        } catch (err: unknown) {
                          setError((err as Error).message || "Gagal menghapus kuis.");
                        }
                      }
                    }}
                      className="px-3 py-2.5 rounded-lg border border-[#ff2a6d]/20 text-[#ff2a6d] transition-all">
                      🗑️
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ SHARE MODAL ═══ */}
      {shareRoomCode && (
        <ShareModal roomCode={shareRoomCode} onClose={() => setShareRoomCode(null)} />
      )}

      {/* ═══ QUIZ EDITOR MODAL ═══ */}
      <AnimatePresence>
        {editing && (
          <motion.div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            <motion.div className="glass-panel w-full max-w-2xl my-8 p-6 relative overflow-hidden"
              initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.9, opacity:0 }}>
              
              {/* 🔮 AI Generating futuristic overlay! */}
              <AnimatePresence>
                {aiGenerating && (
                  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-6 text-center">
                    <motion.div className="w-16 h-16 border-4 border-t-transparent border-[#f5e642] rounded-full mb-6"
                      animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
                    <h3 className="text-xl font-bold font-['Orbitron'] neon-text-cyan tracking-wider mb-2 animate-pulse">🔮 AI MAGIC GENERATOR</h3>
                    <p className="text-xs text-[#a8bfd0] font-mono max-w-sm">MENGKOMPILASI KUIS TERKUSTOMISASI... DOKUMEN SISTEM BERHASIL DEKODING...</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white font-['Orbitron'] tracking-wider">
                  {quizzes.some(q => q.id === editing.id) ? "✏️ EDIT QUIZ" : "➕ QUIZ BARU"}
                </h2>
                <button onClick={() => { setEditing(null); setError(""); }}
                  className="text-[#546e7a] hover:text-white text-2xl leading-none">✕</button>
              </div>

              <div className="flex gap-3 mb-5 items-end flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-[#00d4ff] uppercase tracking-widest mb-1.5 block">Judul Kuis</label>
                  <input className="w-full bg-[#0d1a2e]/80 border border-[#00d4ff]/30 rounded-lg p-3 text-white
                    focus:outline-none focus:border-[#00d4ff] focus:shadow-[0_0_10px_rgba(0,212,255,0.2)] transition
                    placeholder:text-[#546e7a]"
                    placeholder="Contoh: Ulangan Fisika Bab 3"
                    value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-[#00d4ff] uppercase tracking-widest mb-1.5 block">Mode Permainan</label>
                  <select className="w-full bg-[#0d1a2e]/80 border border-[#00d4ff]/30 rounded-lg p-3 text-white focus:outline-none focus:border-[#00d4ff] transition"
                    value={editing.mode} onChange={e => setEditing({ ...editing, mode: e.target.value as 'BOSS_BATTLE' | 'BATTLE_ROYALE' | 'TEAM_BATTLE' })}>
                    <option value="BOSS_BATTLE">Boss Battle 🐉</option>
                    <option value="BATTLE_ROYALE">Battle Royale 👑</option>
                    <option value="TEAM_BATTLE">Team Battle 🔴🔵</option>
                  </select>
                </div>
                <button type="button" onClick={() => setShowAiModal(true)}
                  className="p-3 bg-[#f5e642] hover:bg-[#ffe800] text-[#050508] font-bold rounded-lg text-xs transition
                    font-['Orbitron'] tracking-wider h-[46px] shrink-0 flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(245,230,66,0.25)] border border-[#f5e642]/40">
                  🔮 AI GENERATOR
                </button>
              </div>

              <div className="space-y-4 mb-5 max-h-[45vh] overflow-y-auto pr-1">
                {editing.questions.map((q, qi) => (
                  <div key={q.id} className="bg-[#0d1a2e]/60 rounded-xl p-4 border border-[#00d4ff]/10">
                    <div className="flex justify-between mb-3">
                      <span className="text-[#00d4ff] font-bold text-xs font-['Orbitron'] tracking-wider">SOAL #{qi + 1}</span>
                      {editing.questions.length > 1 && (
                        <button className="text-[#ff2a6d] text-xs hover:text-red-300"
                          onClick={() => setEditing({ ...editing, questions: editing.questions.filter((_, i) => i !== qi) })}>
                          Hapus
                        </button>
                      )}
                    </div>
                    <input className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white text-sm
                      focus:outline-none focus:border-[#00d4ff]/50 transition mb-3 placeholder:text-[#546e7a]"
                      placeholder="Tulis pertanyaan..." value={q.text}
                      onChange={e => updateQ(qi, { text: e.target.value })} />
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-xs text-[#546e7a]">Waktu:</label>
                      <select className="bg-black/40 border border-white/10 rounded p-1 text-white text-xs"
                        value={q.timeLimit} onChange={e => updateQ(qi, { timeLimit: +e.target.value })}>
                        {[15,20,30,45,60].map(t => <option key={t} value={t}>{t}s</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.answers.map((a, ai) => (
                        <div key={a.id} className={`flex items-center gap-2 rounded-lg p-2 border transition
                          ${a.isCorrect ? "border-[#00d4ff]/50 bg-[#00d4ff]/8" : "border-white/10"}`}>
                          <input type="radio" name={`correct-${q.id}`} checked={a.isCorrect}
                            onChange={() => updateA(qi, ai, { isCorrect: true })}
                            className="accent-[#00d4ff] cursor-pointer shrink-0" title="Jawaban benar" />
                          <input className="flex-1 bg-transparent text-white text-sm focus:outline-none min-w-0 placeholder:text-[#546e7a]"
                            placeholder={`Pilihan ${["A","B","C","D"][ai]}`}
                            value={a.text} onChange={e => updateA(qi, ai, { text: e.target.value })} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button className="w-full border border-dashed border-[#00d4ff]/30 text-[#546e7a] hover:text-[#00d4ff]
                hover:border-[#00d4ff]/60 rounded-xl py-3 text-sm transition mb-5"
                onClick={() => setEditing({ ...editing, questions: [...editing.questions, blankQuestion()] })}>
                + Tambah Soal
              </button>

              {error && <p className="text-[#ff2a6d] text-sm mb-4">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => { setEditing(null); setError(""); }}
                  className="flex-1 py-3 border border-white/10 text-[#a8bfd0] hover:text-white rounded-lg font-bold text-sm transition">
                  Batal
                </button>
                <motion.button whileTap={{ scale:0.96 }} onClick={saveEditing}
                  className="flex-1 py-3 bg-[#00d4ff] hover:bg-[#33e5ff] text-[#050508] font-bold rounded-lg text-sm transition neon-border-cyan">
                  💾 Simpan Quiz
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔮 AI GENERATOR CONFIGURATION MODAL */}
      <AnimatePresence>
        {showAiModal && (
          <motion.div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            <motion.div className="glass-panel w-full max-w-md p-6 relative border border-[#f5e642]/30"
              initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.9, opacity:0 }}>
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-bold text-[#f5e642] font-['Orbitron'] tracking-wider">
                  🔮 AI QUIZ GENERATOR
                </h3>
                <button onClick={() => { setShowAiModal(false); }}
                  className="text-[#546e7a] hover:text-white text-xl">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-[#00d4ff] uppercase tracking-widest mb-1.5 block">Topik Pembelajaran</label>
                  <input className="w-full bg-[#0d1a2e]/80 border border-[#00d4ff]/30 rounded-lg p-3 text-white
                    focus:outline-none focus:border-[#00d4ff] transition placeholder:text-[#546e7a] text-sm"
                    placeholder="Contoh: Sejarah Kemerdekaan, Struktur Sel, Trigonometri"
                    value={aiTopic} onChange={e => setAiTopic(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#00d4ff] uppercase tracking-widest mb-1.5 block">Jumlah Soal ({aiCount})</label>
                  <div className="flex gap-2">
                    {[3, 5, 10, 15, 20].map(cnt => (
                      <button key={cnt} type="button" onClick={() => setAiCount(cnt)}
                        className={`flex-1 py-2 rounded text-xs font-bold font-['Orbitron'] border transition
                          ${aiCount === cnt
                            ? "bg-[#00d4ff] text-black border-[#00d4ff]"
                            : "bg-transparent text-[#546e7a] border-white/10 hover:border-[#00d4ff]/30"}`}>
                        {cnt} Soal
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowAiModal(false)}
                  className="flex-1 py-2.5 border border-white/10 text-[#a8bfd0] hover:text-white rounded-lg font-bold text-xs transition">
                  Batal
                </button>
                <motion.button whileTap={{ scale:0.96 }} onClick={handleAIGenerate}
                  className="flex-1 py-2.5 bg-[#f5e642] hover:bg-[#ffe800] text-[#050508] font-bold rounded-lg text-xs transition font-['Orbitron'] shadow-[0_0_15px_rgba(245,230,66,0.25)] border border-[#f5e642]/40">
                  🚀 GENERATE SOAL
                </motion.button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
