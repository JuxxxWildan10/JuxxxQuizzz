"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Cyberpunk background blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#00d4ff] rounded-full blur-[160px] opacity-8" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#0050a0] rounded-full blur-[180px] opacity-15" />
        <div className="absolute top-3/4 left-1/2 w-48 h-48 bg-[#f5e642] rounded-full blur-[120px] opacity-5" />
        {/* Grid lines */}
        <div className="absolute inset-0"
          style={{ backgroundImage:'linear-gradient(rgba(0,212,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.04) 1px,transparent 1px)', backgroundSize:'60px 60px' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 text-center max-w-4xl"
      >
        {/* Label */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3 }}
          className="inline-flex items-center gap-2 border border-[#00d4ff]/40 text-[#00d4ff] text-xs font-bold
            px-4 py-1.5 rounded-full mb-6 glass-panel tracking-widest uppercase">
          <span className="w-1.5 h-1.5 bg-[#00d4ff] rounded-full animate-pulse" />
          Realtime Battle Platform
        </motion.div>

        <h1 className="text-5xl md:text-7xl font-bold font-['Orbitron'] text-white mb-6 leading-tight">
          LEVEL UP YOUR
          <br />
          <span className="neon-text-pink">LEARNING</span>{" "}
          <span className="neon-text-cyan">GAME</span>
        </h1>
        <p className="text-lg text-[#a8bfd0] mb-10 leading-relaxed max-w-2xl mx-auto">
          EduBattle adalah platform belajar gamified paling epik. Lawan Boss bersama,
          bersaing Real-time, dan panjat Global Ranking hingga ke puncak.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/battle">
            <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
              className="px-8 py-4 bg-[#00d4ff] hover:bg-[#33e5ff] text-[#050508] font-bold rounded-lg
                neon-border-cyan transition-all w-full sm:w-auto font-['Orbitron'] text-sm tracking-wider">
              ⚔️ JOIN BATTLE ARENA
            </motion.button>
          </Link>
          <Link href="/login">
            <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
              className="px-8 py-4 bg-transparent border-2 border-[#f5e642] text-[#f5e642]
                hover:bg-[#f5e642] hover:text-[#050508] font-bold rounded-lg transition-all
                w-full sm:w-auto shadow-[0_0_15px_rgba(245,230,66,0.3)] font-['Orbitron'] text-sm tracking-wider">
              👨‍🏫 TEACHER MODE
            </motion.button>
          </Link>
        </div>
      </motion.div>

      {/* Feature Cards */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full max-w-5xl"
      >
        {[
          { icon:"🐉", title:"Boss Battle",    color:"neon-text-cyan",   border:"border-[#00d4ff]/30", desc:"Kalahkan boss bersama kelas dengan menjawab soal dan membangun combo streak." },
          { icon:"👑", title:"Ranking System", color:"neon-text-pink",   border:"border-[#f5e642]/30", desc:"Kumpulkan XP dan naik dari Bronze ke Mythic. Unlock avatar eksklusif." },
          { icon:"🤖", title:"AI Quiz Gen",    color:"text-[#ff2a6d]",   border:"border-[#ff2a6d]/30", desc:"Guru bisa generate soal dari PDF atau Excel menggunakan AI engine kami." },
        ].map((card, i) => (
          <motion.div key={card.title}
            initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.4 + i*0.1 }}
            whileHover={{ y:-6, scale:1.01 }}
            className={`glass-panel p-6 border ${card.border} transition-all duration-300 cursor-default`}
          >
            <div className="text-4xl mb-4">{card.icon}</div>
            <h3 className={`text-xl font-bold mb-2 font-['Orbitron'] ${card.color}`}>{card.title}</h3>
            <p className="text-[#a8bfd0] text-sm leading-relaxed">{card.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
