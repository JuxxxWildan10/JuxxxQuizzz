"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { type Achievement } from "@/lib/xp";

interface Props {
  achievement: Achievement | null;
  onDone: () => void;
}

export default function AchievementPopup({ achievement, onDone }: Props) {
  useEffect(() => {
    if (!achievement) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [achievement, onDone]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0, y: -60, scale: 0.8 }}
          animate={{ opacity: 1, y: 0,   scale: 1    }}
          exit={{   opacity: 0, y: -40,  scale: 0.9  }}
          transition={{ type: "spring", bounce: 0.4 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[9998] pointer-events-none"
        >
          <div className="glass-panel px-6 py-4 flex items-center gap-4 border border-[#f5e642]/50
            shadow-[0_0_30px_rgba(245,230,66,0.3)] min-w-[280px]">
            <div className="text-4xl animate-bounce">{achievement.icon}</div>
            <div>
              <p className="text-[10px] font-bold text-[#f5e642] uppercase tracking-widest font-['Orbitron'] mb-0.5">
                🏆 Achievement Unlocked!
              </p>
              <p className="text-white font-bold text-base">{achievement.name}</p>
              <p className="text-[#a8bfd0] text-xs">{achievement.desc}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
