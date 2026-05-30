"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getQuizzes, SAMPLE_QUIZ, type Quiz } from "@/lib/quizStore";
import { getUser } from "@/lib/auth";
import { sound } from "@/lib/sound";
import { addXP, unlockAchievement, ACHIEVEMENTS } from "@/lib/xp";
import AchievementPopup from "@/components/AchievementPopup";
import type { Achievement } from "@/lib/xp";

const QUESTION_TIME = 30;

export default function PracticePage() {
  const [quizzes,    setQuizzes]    = useState<Quiz[]>([]);
  const [selected,   setSelected]   = useState<Quiz | null>(null);
  const [qIdx,       setQIdx]       = useState(0);
  const [timeLeft,   setTimeLeft]   = useState(QUESTION_TIME);
  const [answered,   setAnswered]   = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score,      setScore]      = useState(0);
  const [combo,      setCombo]      = useState(0);
  const [results,    setResults]    = useState<{ correct: boolean; time: number }[]>([]);
  const [done,       setDone]       = useState(false);
  const [achievement, setAchievement] = useState<Achievement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function loadData() {
      const user = getUser();
      // Only teachers have quizzes in DB; students get SAMPLE_QUIZ as fallback
      if (user?.role !== 'GURU') {
        setQuizzes([SAMPLE_QUIZ]);
        return;
      }
      try {
        const qs = await getQuizzes();
        setQuizzes(qs.length > 0 ? qs : [SAMPLE_QUIZ]);
      } catch (err) {
        console.error("Gagal memuat kuis latihan:", err);
        setQuizzes([SAMPLE_QUIZ]); // fallback gracefully
      }
    }
    loadData();
  }, []);

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

  const startQuiz = (quiz: Quiz) => {
    setSelected(quiz); setQIdx(0); setScore(0); setCombo(0);
    setResults([]); setDone(false); setAnswered(false); setSelectedId(null);
    startTimer(quiz.questions[0]?.timeLimit ?? QUESTION_TIME);
  };

  const submitAnswer = (answerId: string | undefined) => {
    if (!answerId || answered || !selected) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setAnswered(true);
    setSelectedId(answerId);

    const q         = selected.questions[qIdx];
    const isCorrect = q.answers.find(a => a.id === answerId)?.isCorrect ?? false;
    const timeTaken = (q.timeLimit ?? QUESTION_TIME) - timeLeft;

    if (isCorrect) {
      const newCombo = combo + 1;
      const speedB   = Math.max(0, ((q.timeLimit ?? 30) - timeTaken) * 5);
      const pts      = 100 * newCombo + speedB;
      setCombo(newCombo);
      setScore(s => s + pts);
      sound.play(newCombo >= 5 ? "combo" : "correct");
      if (newCombo >= 5 && unlockAchievement("combo-5")) {
        setAchievement(ACHIEVEMENTS.find(a => a.id === "combo-5") ?? null);
        sound.play("achievement");
      }
      if (timeTaken < 3 && unlockAchievement("speed-demon")) {
        setAchievement(ACHIEVEMENTS.find(a => a.id === "speed-demon") ?? null);
        sound.play("achievement");
      }
    } else {
      setCombo(0);
      sound.play("wrong");
    }

    setResults(r => [...r, { correct: isCorrect, time: timeTaken }]);

    // Next question after 1.5s
    setTimeout(() => {
      const nextIdx = qIdx + 1;
      if (nextIdx >= selected.questions.length) {
        setDone(true);
        sound.play("victory");
        // XP reward
        const correctCount = results.filter(r => r.correct).length + (isCorrect ? 1 : 0);
        addXP(Math.floor(score / 10) + correctCount * 10, score);
        if (unlockAchievement("first-battle")) {
          setAchievement(ACHIEVEMENTS.find(a => a.id === "first-battle") ?? null);
          sound.play("achievement");
        }
        if (correctCount === selected.questions.length && unlockAchievement("perfect")) {
          setAchievement(ACHIEVEMENTS.find(a => a.id === "perfect") ?? null);
          sound.play("achievement");
        }
      } else {
        setQIdx(nextIdx);
        setAnswered(false);
        setSelectedId(null);
        startTimer(selected.questions[nextIdx]?.timeLimit ?? QUESTION_TIME);
      }
    }, 1500);
  };

  if (done && selected) {
    const correctCount = results.filter(r => r.correct).length;
    const accuracy     = Math.round((correctCount / selected.questions.length) * 100);
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
        <motion.div initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
          className="glass-panel p-8 w-full max-w-md text-center border border-[#00d4ff]/30">
          <div className="text-6xl mb-4">{accuracy === 100 ? "🏆" : accuracy >= 70 ? "⭐" : "📚"}</div>
          <h2 className="text-2xl font-bold font-['Orbitron'] neon-text-cyan mb-4 tracking-wider">SELESAI!</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { l:"Skor",    v:score.toLocaleString(),         c:"neon-text-cyan" },
              { l:"Akurasi", v:`${accuracy}%`,                 c:"neon-text-pink" },
              { l:"Benar",   v:`${correctCount}/${selected.questions.length}`, c:"text-green-400" },
              { l:"XP Dapat",v:`+${Math.floor(score/10)+correctCount*10}`, c:"text-[#f5e642]" },
            ].map(s => (
              <div key={s.l} className="bg-[#0d1a2e]/60 rounded-xl p-3 border border-white/5">
                <p className={`text-xl font-bold font-['Orbitron'] ${s.c}`}>{s.v}</p>
                <p className="text-[#546e7a] text-xs">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <motion.button whileTap={{ scale:0.96 }} onClick={() => startQuiz(selected)}
              className="flex-1 py-3 bg-[#00d4ff] hover:bg-[#33e5ff] text-[#050508] font-bold rounded-lg
                neon-border-cyan transition text-sm font-['Orbitron']">
              🔄 Ulangi
            </motion.button>
            <motion.button whileTap={{ scale:0.96 }} onClick={() => { setSelected(null); setDone(false); }}
              className="flex-1 py-3 border border-white/20 text-[#a8bfd0] hover:text-white rounded-lg font-bold text-sm transition">
              Quiz Lain
            </motion.button>
          </div>
        </motion.div>
        <AchievementPopup achievement={achievement} onDone={() => setAchievement(null)} />
      </div>
    );
  }

  if (!selected) return (
    <div className="min-h-[calc(100vh-64px)] p-4 md:p-8 max-w-3xl mx-auto">
      <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="text-center mb-8">
        <div className="text-5xl mb-3">🎯</div>
        <h1 className="text-3xl font-bold font-['Orbitron'] tracking-wider">
          <span className="text-white">PRACTICE</span> <span className="neon-text-cyan">MODE</span>
        </h1>
        <p className="text-[#546e7a] mt-2 text-sm">Latihan solo tanpa tekanan — jawab soal dan tingkatkan skill!</p>
      </motion.div>

      {quizzes.length === 0 ? (
        <div className="glass-panel p-8 text-center border border-[#00d4ff]/20">
          <p className="text-[#a8bfd0] mb-4">Belum ada quiz. Buat quiz di Dashboard dulu!</p>
          <a href="/dashboard" className="text-[#00d4ff] hover:text-[#33e5ff] font-bold text-sm underline">
            → Buka Dashboard
          </a>
        </div>
      ) : (
        <div className="grid gap-4">
          {quizzes.map((quiz, i) => (
            <motion.div key={quiz.id} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-panel p-5 flex justify-between items-center border border-[#00d4ff]/10
                hover:border-[#00d4ff]/30 transition cursor-pointer group"
              onClick={() => startQuiz(quiz)}>
              <div>
                <h3 className="text-white font-bold group-hover:text-[#00d4ff] transition">{quiz.title}</h3>
                <p className="text-[#546e7a] text-xs mt-1">{quiz.questions.length} soal</p>
              </div>
              <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
                className="px-5 py-2 bg-[#00d4ff]/10 border border-[#00d4ff]/40 text-[#00d4ff]
                  rounded-lg font-bold text-sm hover:bg-[#00d4ff] hover:text-[#050508] transition">
                Mulai ▶
              </motion.button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const q       = selected.questions[qIdx];
  const timePct = (timeLeft / (q.timeLimit ?? QUESTION_TIME)) * 100;
  const correct = q.answers.find(a => a.isCorrect);

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 max-w-2xl mx-auto flex flex-col justify-center">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 glass-panel px-4 py-3">
        <div className="text-sm text-[#546e7a]">
          Soal <span className="text-white font-bold">{qIdx+1}</span>/{selected.questions.length}
        </div>
        <div className="text-sm font-bold neon-text-cyan font-['Orbitron']">
          {score.toLocaleString()} PTS
        </div>
        {combo > 1 && (
          <motion.div animate={{ scale:[1,1.2,1] }} transition={{ repeat:Infinity, duration:0.8 }}
            className="text-sm text-[#f5e642] font-bold">{combo}× 🔥</motion.div>
        )}
      </div>

      {/* Timer */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-2.5 bg-[#0d1a2e] rounded-full overflow-hidden border border-white/10">
          <motion.div className={`h-full rounded-full transition-colors duration-500
            ${timeLeft > 15 ? "bg-[#00d4ff]" : timeLeft > 7 ? "bg-[#f5e642]" : "bg-[#ff2a6d]"}`}
            animate={{ width:`${timePct}%` }} transition={{ duration:0.9, ease:"linear" }} />
        </div>
        <span className={`font-mono font-bold text-lg w-7 text-right
          ${timeLeft > 15 ? "text-[#00d4ff]" : timeLeft > 7 ? "text-[#f5e642]" : "text-[#ff2a6d]"}`}>
          {timeLeft}
        </span>
      </div>

      {/* Question */}
      <div className="glass-panel p-6 mb-5 border border-[#00d4ff]/20">
        <h2 className="text-lg text-white font-bold leading-snug">{q.text}</h2>
      </div>

      {/* Answers */}
      <div className="grid grid-cols-2 gap-3">
        {q.answers.map((a, i) => {
          let cls = "bg-[#0d1a2e]/60 hover:bg-[#0d1a2e] border-white/10 hover:border-[#00d4ff]/50";
          if (answered) {
            if (a.id === correct?.id) cls = "bg-green-500/20 border-green-500";
            else if (a.id === selectedId) cls = "bg-[#ff2a6d]/20 border-[#ff2a6d]";
            else cls = "bg-[#0d1a2e]/30 border-white/5 opacity-40";
          }
          return (
            <motion.button key={a.id} whileHover={answered ? {} : { scale:1.02 }}
              whileTap={answered ? {} : { scale:0.97 }}
              onClick={() => submitAnswer(a.id)}
              disabled={answered || timeLeft === 0}
              className={`p-4 rounded-xl border-2 text-left transition text-white text-sm font-medium
                disabled:cursor-not-allowed ${cls}`}>
              <span className="text-[#00d4ff] font-bold text-xs mr-2">{["A","B","C","D"][i]}.</span>
              {a.text}
            </motion.button>
          );
        })}
      </div>

      {answered && (
        <motion.p initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }}
          className={`text-center mt-4 text-sm font-bold ${selectedId === correct?.id ? "text-green-400" : "text-[#ff2a6d]"}`}>
          {selectedId === correct?.id ? `✅ Benar! +${100 * combo + Math.max(0, ((q.timeLimit ?? 30) - ((q.timeLimit ?? QUESTION_TIME) - timeLeft)) * 5)} pts` : `❌ Salah! Jawaban: ${correct?.text}`}
        </motion.p>
      )}

      <AnimatePresence>
        <AchievementPopup achievement={achievement} onDone={() => setAchievement(null)} />
      </AnimatePresence>
    </div>
  );
}
