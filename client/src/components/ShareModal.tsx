"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  roomCode: string;
  onClose: () => void;
}

export default function ShareModal({ roomCode, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/battle?code=${roomCode}`
    : `/battle?code=${roomCode}`;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWA = () => {
    const msg = `⚔️ Join EduBattle Arena!\nKode Room: *${roomCode}*\nLink: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}>
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="glass-panel p-6 w-full max-w-sm border border-[#00d4ff]/30"
        >
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-bold font-['Orbitron'] text-white tracking-wider">📡 SHARE ARENA</h2>
            <button onClick={onClose} className="text-[#546e7a] hover:text-white text-xl">✕</button>
          </div>

          {/* Room code display */}
          <div className="bg-[#0d1a2e] border border-[#00d4ff]/30 rounded-xl p-4 text-center mb-4">
            <p className="text-[10px] text-[#546e7a] uppercase tracking-widest mb-1">Kode Room</p>
            <p className="text-4xl font-bold font-['Orbitron'] neon-text-cyan tracking-[0.3em]">{roomCode}</p>
          </div>

          {/* URL */}
          <div className="bg-[#0d1a2e]/60 border border-white/10 rounded-lg p-3 mb-4 flex items-center gap-2">
            <p className="text-[#a8bfd0] text-xs flex-1 truncate">{url}</p>
            <button onClick={() => copy(url)}
              className="text-xs px-2 py-1 rounded bg-[#00d4ff]/10 text-[#00d4ff] hover:bg-[#00d4ff]/20 transition shrink-0">
              {copied ? "✓" : "Salin"}
            </button>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => copy(roomCode)}
              className="py-3 bg-[#00d4ff]/10 border border-[#00d4ff]/40 text-[#00d4ff] rounded-lg
                text-sm font-bold hover:bg-[#00d4ff]/20 transition">
              📋 Salin Kode
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={shareWA}
              className="py-3 bg-[#25d366]/10 border border-[#25d366]/40 text-[#25d366] rounded-lg
                text-sm font-bold hover:bg-[#25d366]/20 transition">
              💬 WhatsApp
            </motion.button>
          </div>

          <p className="text-[#546e7a] text-xs text-center mt-4">
            Bagikan kode ke siswa agar bisa join arena
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
