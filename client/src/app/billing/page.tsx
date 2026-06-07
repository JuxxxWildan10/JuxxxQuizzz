"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

const plans = [
  {
    id: "FREE",
    name: "Basic",
    price: "Gratis",
    period: "",
    color: "#546e7a",
    borderColor: "border-white/10",
    icon: "🎮",
    desc: "Untuk guru yang baru mulai.",
    features: [
      { text: "Maks 3 Kuis Tersimpan", ok: true },
      { text: "Maks 20 Siswa per Room", ok: true },
      { text: "Mode Boss Battle", ok: true },
      { text: "AI Quiz Generator (3x/bulan)", ok: true },
      { text: "Analytics Dasar", ok: false },
      { text: "Export Laporan PDF/Excel", ok: false },
      { text: "Anti-Cheat AI Detector", ok: false },
      { text: "Custom Logo Sekolah", ok: false },
      { text: "Dukungan Prioritas", ok: false },
    ],
    cta: "Mulai Gratis",
    href: "/login",
    highlight: false,
  },
  {
    id: "PRO",
    name: "Pro Guru",
    price: "Rp 149.000",
    period: "/bulan",
    color: "#00d4ff",
    borderColor: "border-[#00d4ff]/50",
    icon: "⚡",
    badge: "TERLARIS",
    desc: "Untuk guru aktif yang mengajar setiap hari.",
    features: [
      { text: "Unlimited Kuis & Soal", ok: true },
      { text: "Maks 100 Siswa per Room", ok: true },
      { text: "Semua 3 Mode Battle", ok: true },
      { text: "AI Quiz Generator (Unlimited)", ok: true },
      { text: "Advanced Analytics Dashboard", ok: true },
      { text: "Export Laporan PDF/Excel", ok: true },
      { text: "Anti-Cheat AI Detector", ok: false },
      { text: "Custom Logo Sekolah", ok: false },
      { text: "Dukungan Prioritas", ok: false },
    ],
    cta: "Mulai Pro",
    href: "/login",
    highlight: true,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: "Rp 299.000",
    period: "/bulan",
    color: "#a855f7",
    borderColor: "border-[#a855f7]/50",
    icon: "💎",
    desc: "Untuk sekolah & lembaga pendidikan.",
    features: [
      { text: "Unlimited Kuis & Soal", ok: true },
      { text: "1000+ Siswa per Room", ok: true },
      { text: "Semua 3 Mode Battle", ok: true },
      { text: "AI Quiz Generator (Unlimited)", ok: true },
      { text: "Advanced Analytics Dashboard", ok: true },
      { text: "Export Laporan PDF/Excel", ok: true },
      { text: "Anti-Cheat AI Detector", ok: true },
      { text: "Custom Logo Sekolah (White-label)", ok: true },
      { text: "Dukungan Prioritas 24/7", ok: true },
    ],
    cta: "Hubungi Sales",
    href: "mailto:sales@edubattle.id",
    highlight: false,
  },
];

const faqs = [
  {
    q: "Apakah saya bisa mencoba sebelum membeli?",
    a: "Ya! Paket Basic sepenuhnya gratis selamanya. Anda bisa membuat hingga 3 kuis dan mengelola sesi dengan 20 siswa tanpa biaya apapun.",
  },
  {
    q: "Bagaimana cara pembayaran?",
    a: "Kami menerima transfer bank, QRIS, GoPay, OVO, dan semua metode pembayaran populer Indonesia melalui Midtrans.",
  },
  {
    q: "Apakah data siswa aman?",
    a: "Semua data terenkripsi dan disimpan di server Indonesia. Kami mematuhi regulasi perlindungan data pribadi dan tidak pernah menjual data pengguna.",
  },
  {
    q: "Bisakah saya upgrade atau downgrade kapan saja?",
    a: "Ya, Anda bisa upgrade ke paket lebih tinggi kapan saja. Downgrade berlaku di awal siklus billing berikutnya.",
  },
];

export default function BillingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="min-h-[calc(100vh-64px)] pb-24 relative overflow-hidden">
      {/* BG */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-[#a855f7]/10 to-transparent rounded-b-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-16 pb-12">
          <div className="inline-flex items-center gap-2 border border-[#a855f7]/40 text-[#a855f7] text-xs font-bold px-4 py-1.5 rounded-full mb-6 tracking-widest uppercase bg-[#a855f7]/5">
            💎 HARGA TRANSPARAN
          </div>
          <h1 className="text-4xl md:text-6xl font-bold font-['Orbitron'] text-white mb-4">
            Pilih Paket Yang<br />
            <span style={{ color: "#a855f7", textShadow: "0 0 30px rgba(168,85,247,0.5)" }}>Tepat Untuk Anda</span>
          </h1>
          <p className="text-[#a8bfd0] text-lg max-w-xl mx-auto mb-8">
            Tidak ada biaya tersembunyi. Batal kapan saja.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 glass-panel px-2 py-1.5 rounded-full border border-white/10">
            <button onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${billing === "monthly" ? "bg-white text-[#050508]" : "text-[#546e7a] hover:text-white"}`}>
              Bulanan
            </button>
            <button onClick={() => setBilling("yearly")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${billing === "yearly" ? "bg-white text-[#050508]" : "text-[#546e7a] hover:text-white"}`}>
              Tahunan <span className="text-[#4ade80] text-[10px] font-bold bg-[#4ade80]/10 px-1.5 py-0.5 rounded-full">HEMAT 20%</span>
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {plans.map((plan, i) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
              className={`relative glass-panel p-8 border-2 ${plan.borderColor} flex flex-col ${plan.highlight ? "md:-translate-y-4 shadow-[0_0_50px_rgba(0,212,255,0.1)]" : ""}`}
              style={plan.highlight ? { background: "rgba(0,212,255,0.03)" } : {}}>
              {plan.badge && (
                <div className="absolute top-0 right-6 -translate-y-1/2 text-[#050508] text-[10px] font-bold px-3 py-1 rounded-full font-['Orbitron'] tracking-widest"
                  style={{ background: "linear-gradient(90deg, #00d4ff, #0080ff)" }}>
                  {plan.badge}
                </div>
              )}

              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border border-white/10 bg-white/5">
                  {plan.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold font-['Orbitron']" style={{ color: plan.color }}>{plan.name}</h3>
                  <p className="text-xs text-[#546e7a]">{plan.desc}</p>
                </div>
              </div>

              <div className="mb-6 pb-6 border-b border-white/5">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold font-['Orbitron'] text-white">
                    {billing === "yearly" && plan.price !== "Gratis"
                      ? `Rp ${Math.round(parseInt(plan.price.replace(/\D/g, "")) * 0.8).toLocaleString("id-ID")}`
                      : plan.price}
                  </span>
                  <span className="text-[#546e7a] text-sm mb-1">{plan.period}</span>
                </div>
                {billing === "yearly" && plan.price !== "Gratis" && (
                  <p className="text-[#4ade80] text-xs mt-1">🎉 Hemat Rp {Math.round(parseInt(plan.price.replace(/\D/g, "")) * 12 * 0.2).toLocaleString("id-ID")}/tahun</p>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f.text} className={`flex items-center gap-3 text-sm ${f.ok ? "text-[#a8bfd0]" : "text-[#546e7a] line-through"}`}>
                    <span className={`shrink-0 text-base ${f.ok ? "" : "opacity-30"}`}>{f.ok ? "✓" : "✕"}</span>
                    {f.text}
                  </li>
                ))}
              </ul>

              <Link href={plan.href}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-xl font-bold font-['Orbitron'] text-sm tracking-wider transition-all"
                  style={plan.highlight
                    ? { background: "linear-gradient(135deg, #00d4ff, #0080ff)", color: "#050508", boxShadow: "0 0 20px rgba(0,212,255,0.35)" }
                    : plan.id === "ENTERPRISE"
                    ? { background: "linear-gradient(135deg, #a855f7, #d946ef)", color: "#ffffff", boxShadow: "0 0 15px rgba(168,85,247,0.3)" }
                    : { border: "1px solid rgba(255,255,255,0.15)", color: "#a8bfd0", background: "rgba(255,255,255,0.03)" }}>
                  {plan.cta}
                </motion.button>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Compare Table */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-20 overflow-x-auto">
          <h2 className="text-2xl font-bold font-['Orbitron'] text-white text-center mb-8">Perbandingan Lengkap</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-4 px-4 text-left text-[#546e7a] font-normal w-1/2">Fitur</th>
                {plans.map(p => (
                  <th key={p.id} className="py-4 px-4 text-center font-bold" style={{ color: p.color }}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Kuis Tersimpan", vals: ["3", "Unlimited", "Unlimited"] },
                { label: "Siswa per Room", vals: ["20", "100", "1000+"] },
                { label: "Mode Battle", vals: ["1", "3", "3"] },
                { label: "AI Generator", vals: ["3x/bulan", "Unlimited", "Unlimited"] },
                { label: "Advanced Analytics", vals: ["❌", "✅", "✅"] },
                { label: "Export PDF/Excel", vals: ["❌", "✅", "✅"] },
                { label: "Anti-Cheat AI", vals: ["❌", "❌", "✅"] },
                { label: "White-label", vals: ["❌", "❌", "✅"] },
                { label: "Prioritas Support", vals: ["❌", "❌", "✅"] },
              ].map((row, i) => (
                <tr key={row.label} className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                  <td className="py-3 px-4 text-[#a8bfd0]">{row.label}</td>
                  {row.vals.map((v, j) => (
                    <td key={j} className={`py-3 px-4 text-center font-mono font-bold ${v === "✅" ? "text-[#4ade80]" : v === "❌" ? "text-[#546e7a]" : "text-white"}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold font-['Orbitron'] text-white text-center mb-8">Pertanyaan Umum</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="glass-panel border border-white/10 overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-5 py-4 flex justify-between items-center text-left text-white font-medium hover:bg-white/5 transition">
                  <span className="text-sm pr-4">{faq.q}</span>
                  <motion.span animate={{ rotate: openFaq === i ? 45 : 0 }} className="text-[#00d4ff] text-xl shrink-0">+</motion.span>
                </button>
                <motion.div initial={false} animate={{ height: openFaq === i ? "auto" : 0, opacity: openFaq === i ? 1 : 0 }}
                  transition={{ duration: 0.2 }} className="overflow-hidden">
                  <p className="px-5 pb-4 text-[#a8bfd0] text-sm leading-relaxed">{faq.a}</p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
