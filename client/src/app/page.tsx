"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

const features = [
  {
    icon: "🐉",
    title: "Boss Battle Mode",
    color: "#00d4ff",
    desc: "Semua siswa menyerang 1 monster bersama. Jawaban benar = damage. Kalah bersama, menang bersama. Engagement kelas naik 300%.",
  },
  {
    icon: "👑",
    title: "Battle Royale Mode",
    color: "#f5e642",
    desc: "Eliminasi langsung! Setiap jawaban salah mengurangi nyawa. Hanya 1 siswa terkuat yang bertahan.",
  },
  {
    icon: "🛡️",
    title: "Team Battle Mode",
    color: "#a855f7",
    desc: "Tim Merah vs Tim Biru. Siswa belajar kolaborasi dan strategi. Cocok untuk review materi kelompok.",
  },
  {
    icon: "🤖",
    title: "AI Quiz Generator",
    color: "#ff2a6d",
    desc: "Ketik topik materi, AI Gemini langsung buat 5-20 soal pilihan ganda dalam hitungan detik. Hemat waktu guru.",
  },
  {
    icon: "📊",
    title: "Advanced Analytics",
    color: "#4ade80",
    desc: "Pantau soal mana yang paling sulit, siapa siswa yang lambat, dan deteksi kecurangan secara otomatis.",
  },
  {
    icon: "🏆",
    title: "XP & Ranking System",
    color: "#f97316",
    desc: "Siswa kumpulkan XP setiap sesi. Naik dari Bronze → Silver → Gold → Diamond → Mythic. Motivasi belajar jangka panjang.",
  },
];

const stats = [
  { value: "10,000+", label: "Siswa Aktif" },
  { value: "500+", label: "Guru Terdaftar" },
  { value: "50,000+", label: "Soal Dibuat" },
  { value: "99.9%", label: "Server Uptime" },
];

const testimonials = [
  {
    name: "Bu Ratna Dewi",
    role: "Guru Matematika, SMAN 3 Surabaya",
    avatar: "👩‍🏫",
    text: "Dulu siswa ngantuk pas ulangan review. Sekarang mereka rebutan mau jawab soal! EduBattle benar-benar mengubah suasana belajar.",
  },
  {
    name: "Pak Budi Santoso",
    role: "Guru IPA, SMP Harapan Bangsa",
    avatar: "👨‍🏫",
    text: "Fitur AI Generator menghemat 2 jam kerja saya setiap minggu. Soal langsung jadi, langsung bisa dipakai main.",
  },
  {
    name: "Kak Dina Lestari",
    role: "Koordinator Akademik, SD Kartini",
    avatar: "👩‍💼",
    text: "Analytics-nya detail banget. Saya bisa langsung tahu siswa mana yang perlu perhatian ekstra tanpa harus koreksi manual.",
  },
];

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div className="overflow-hidden">
      {/* ══════════════ HERO ══════════════ */}
      <section ref={heroRef} className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
        {/* Animated BG */}
        <motion.div style={{ y: heroY }} className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#00d4ff] rounded-full blur-[200px] opacity-10 animate-pulse" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#a855f7] rounded-full blur-[250px] opacity-8" />
          <div className="absolute top-3/4 left-1/3 w-64 h-64 bg-[#f5e642] rounded-full blur-[150px] opacity-5" />
          <div className="absolute inset-0"
            style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.04) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        </motion.div>

        <motion.div style={{ opacity: heroOpacity }} className="z-10 text-center max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 border border-[#00d4ff]/40 text-[#00d4ff] text-xs font-bold
              px-4 py-1.5 rounded-full mb-8 glass-panel tracking-widest uppercase">
            <span className="w-1.5 h-1.5 bg-[#00d4ff] rounded-full animate-ping" />
            Platform Kuis Realtime #1 Indonesia
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold font-['Orbitron'] text-white mb-6 leading-tight">
            BELAJAR LEBIH<br />
            <span className="neon-text-cyan">SERU</span>{" "}
            <span style={{ color: "#a855f7", textShadow: "0 0 30px rgba(168,85,247,0.5)" }}>BERSAMA</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-lg md:text-xl text-[#a8bfd0] mb-10 max-w-2xl mx-auto leading-relaxed">
            Platform gamifikasi belajar interaktif yang mengubah ulangan biasa menjadi pertempuran epik. Tingkatkan engagement siswa hingga{" "}
            <span className="text-[#f5e642] font-bold">300%</span>.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/login">
              <motion.button whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(0,212,255,0.5)" }} whileTap={{ scale: 0.97 }}
                className="px-8 py-4 text-[#050508] font-bold rounded-xl w-full sm:w-auto font-['Orbitron'] text-sm tracking-wider relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #00d4ff, #0080ff)", boxShadow: "0 0 25px rgba(0,212,255,0.35)" }}>
                <motion.div className="absolute inset-0 bg-white/20" initial={{ x: "-100%" }} whileHover={{ x: "100%" }} transition={{ duration: 0.4 }} />
                🚀 MULAI GRATIS
              </motion.button>
            </Link>
            <Link href="/battle">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                className="px-8 py-4 border-2 border-[#f5e642] text-[#f5e642] hover:bg-[#f5e642] hover:text-[#050508]
                  font-bold rounded-xl transition-all w-full sm:w-auto font-['Orbitron'] text-sm tracking-wider
                  shadow-[0_0_20px_rgba(245,230,66,0.25)]">
                ⚔️ COBA DEMO
              </motion.button>
            </Link>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="mt-5 text-[#546e7a] text-xs">
            ✓ Gratis selamanya untuk 3 kuis &nbsp;•&nbsp; ✓ Tanpa kartu kredit &nbsp;•&nbsp; ✓ Setup 5 menit
          </motion.p>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-[#546e7a] text-xs tracking-widest font-mono">
            SCROLL
          </motion.div>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-0.5 h-6 bg-gradient-to-b from-[#546e7a] to-transparent" />
        </motion.div>
      </section>

      {/* ══════════════ STATS ══════════════ */}
      <section className="py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="text-center">
              <div className="text-3xl md:text-4xl font-bold font-['Orbitron'] text-white mb-1" style={{ textShadow: "0 0 20px rgba(0,212,255,0.4)" }}>
                {s.value}
              </div>
              <div className="text-[#546e7a] text-sm">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════ FEATURES ══════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-[#00d4ff] text-xs font-bold tracking-[0.3em] uppercase mb-3">FITUR UNGGULAN</p>
            <h2 className="text-3xl md:text-5xl font-bold font-['Orbitron'] text-white mb-4">
              Semua Yang Guru<br />
              <span className="neon-text-cyan">Butuhkan</span>
            </h2>
            <p className="text-[#546e7a] max-w-lg mx-auto">Dari pembuatan soal hingga analitik performa — satu platform untuk semua kebutuhan evaluasi belajar.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="glass-panel p-7 border border-white/10 hover:border-current transition-all duration-300 group relative overflow-hidden cursor-default"
                style={{ "--tw-text-opacity": 1, color: f.color } as React.CSSProperties}>
                <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300"
                  style={{ background: `radial-gradient(circle at 0% 0%, ${f.color}, transparent)` }} />
                <div className="text-5xl mb-5">{f.icon}</div>
                <h3 className="text-lg font-bold mb-3 font-['Orbitron'] tracking-wide">{f.title}</h3>
                <p className="text-[#a8bfd0] text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ HOW IT WORKS ══════════════ */}
      <section className="py-24 px-6 bg-white/[0.015] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-[#a855f7] text-xs font-bold tracking-[0.3em] uppercase mb-3">CARA KERJA</p>
            <h2 className="text-3xl md:text-4xl font-bold font-['Orbitron'] text-white">Setup Dalam <span style={{ color: "#a855f7", textShadow: "0 0 20px rgba(168,85,247,0.5)" }}>5 Menit</span></h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector Line */}
            <div className="hidden md:block absolute top-10 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-[#00d4ff]/30 via-[#a855f7]/30 to-[#f5e642]/30" />

            {[
              { step: "01", icon: "📝", title: "Buat Kuis", desc: "Tulis soal manual atau gunakan AI Generator. Pilih mode permainan yang sesuai materi.", color: "#00d4ff" },
              { step: "02", icon: "🚀", title: "Deploy Arena", desc: "Klik Deploy — sistem otomatis buat kode room unik. Bagikan ke siswa via QR code atau chat.", color: "#a855f7" },
              { step: "03", icon: "📊", title: "Pantau & Analisis", desc: "Live monitor jawaban siswa real-time. Setelah selesai, unduh laporan performa kelas.", color: "#f5e642" },
            ].map((step, i) => (
              <motion.div key={step.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="text-center relative">
                <div className="w-20 h-20 mx-auto rounded-2xl border-2 flex items-center justify-center text-3xl mb-5 relative z-10 bg-[#050508]"
                  style={{ borderColor: step.color, boxShadow: `0 0 20px ${step.color}30` }}>
                  {step.icon}
                  <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold font-['Orbitron']"
                    style={{ background: step.color, color: "#050508" }}>
                    {step.step}
                  </div>
                </div>
                <h3 className="text-lg font-bold font-['Orbitron'] text-white mb-2">{step.title}</h3>
                <p className="text-[#546e7a] text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ TESTIMONIALS ══════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-[#4ade80] text-xs font-bold tracking-[0.3em] uppercase mb-3">TESTIMONIAL</p>
            <h2 className="text-3xl md:text-4xl font-bold font-['Orbitron'] text-white">
              Kata Mereka <span style={{ color: "#4ade80", textShadow: "0 0 20px rgba(74,222,128,0.4)" }}>Tentang EduBattle</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div key={t.name} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glass-panel p-7 border border-white/10 hover:border-[#4ade80]/30 transition-all duration-300 flex flex-col gap-4">
                <div className="flex items-start gap-1 text-[#f5e642]">
                  {"★★★★★".split("").map((s, j) => <span key={j} className="text-sm">{s}</span>)}
                </div>
                <p className="text-[#a8bfd0] text-sm leading-relaxed italic flex-1">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 border-t border-white/5 pt-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">{t.avatar}</div>
                  <div>
                    <p className="text-white font-bold text-sm">{t.name}</p>
                    <p className="text-[#546e7a] text-[11px]">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ FINAL CTA ══════════════ */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00d4ff]/5 via-transparent to-[#a855f7]/5" />
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.05) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="text-5xl mb-6">⚔️</div>
            <h2 className="text-4xl md:text-5xl font-bold font-['Orbitron'] text-white mb-6">
              Siap Ubah Kelasmu<br />
              <span className="neon-text-cyan">Jadi Arena?</span>
            </h2>
            <p className="text-[#a8bfd0] mb-10 max-w-md mx-auto">
              Mulai gratis hari ini. Tidak perlu kartu kredit. Upgrade kapan saja sesuai kebutuhan.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                  className="px-10 py-4 font-bold rounded-xl font-['Orbitron'] text-sm tracking-wider"
                  style={{ background: "linear-gradient(135deg, #00d4ff, #0080ff)", color: "#050508", boxShadow: "0 0 30px rgba(0,212,255,0.4)" }}>
                  🚀 DAFTAR GRATIS
                </motion.button>
              </Link>
              <Link href="/billing">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                  className="px-10 py-4 border-2 border-[#a855f7] font-bold rounded-xl font-['Orbitron'] text-sm tracking-wider transition-all"
                  style={{ color: "#a855f7", boxShadow: "0 0 20px rgba(168,85,247,0.2)" }}>
                  💎 LIHAT HARGA PRO
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="border-t border-white/5 bg-black/20 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded border border-[#00d4ff]/50 flex items-center justify-center bg-[#00d4ff]/10">
              <span className="text-sm">🐉</span>
            </div>
            <span className="text-xl font-bold font-['Orbitron']">
              <span className="text-white">EDU</span><span className="neon-text-cyan">BATTLE</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-[#546e7a]">
            <Link href="/" className="hover:text-white transition">Beranda</Link>
            <Link href="/billing" className="hover:text-white transition">Harga</Link>
            <Link href="/leaderboard" className="hover:text-white transition">Ranking</Link>
            <Link href="/tournaments" className="hover:text-white transition">Turnamen</Link>
            <Link href="/login" className="hover:text-white transition">Masuk</Link>
          </div>
          <p className="text-[#546e7a] text-xs">© 2025 EduBattle. Semua hak dilindungi.</p>
        </div>
      </footer>
    </div>
  );
}
