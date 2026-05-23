"use client";

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Toast {
  id: number;
  message: string;
  type: 'warning' | 'danger';
}

interface AntiCheatProps {
  children: React.ReactNode;
  onCheatDetected?: (type: string) => void;
}

export default function AntiCheatWrapper({ children, onCheatDetected }: AntiCheatProps) {
  // ✅ useRef avoids stale closure — always holds the current count
  const warningsRef = useRef(0);
  const [warnings, setWarnings] = useState(0);
  const [isCheatDetected, setIsCheatDetected] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const showToast = (message: string, type: 'warning' | 'danger') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        warningsRef.current += 1;
        setWarnings(warningsRef.current);

        if (warningsRef.current >= 3) {
          setIsCheatDetected(true);
          onCheatDetected?.('Tab Switch Limit Reached (3 warnings)');
        } else {
          showToast(
            `⚠️ WARNING ${warningsRef.current}/3: Tab switching detected! This has been logged.`,
            warningsRef.current >= 2 ? 'danger' : 'warning'
          );
          onCheatDetected?.(`Tab Switch Warning ${warningsRef.current}/3`);
        }
      }
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      showToast('🚫 Copy/Paste is disabled during Battle Mode!', 'warning');
      onCheatDetected?.('Copy/Paste Attempt');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onCheatDetected?.('Right Click Menu Attempt');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [onCheatDetected]); // ✅ Dependency allows using dynamic callbacks safely

  if (isCheatDetected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-8">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0.4 }}
          className="text-center max-w-lg"
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-8xl mb-6"
          >
            🚨
          </motion.div>
          <h2 className="text-5xl font-bold font-['Orbitron'] mb-4 text-red-500"
            style={{ textShadow: '0 0 20px #ff0000' }}
          >
            ACCESS DENIED
          </h2>
          <p className="text-lg text-gray-300 mb-6">
            Multiple cheating attempts detected. Your session has been terminated and reported to the teacher.
          </p>
          <div className="glass-panel p-4 border border-red-500/50">
            <p className="text-red-400 text-sm font-mono">
              VIOLATIONS RECORDED: {warnings} / 3 threshold reached
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {children}

      {/* ✅ Toast Notifications — replaces alert() */}
      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 80, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.8 }}
              transition={{ type: 'spring', bounce: 0.3 }}
              className={`glass-panel px-4 py-3 text-sm font-bold max-w-sm pointer-events-auto
                ${toast.type === 'danger'
                  ? 'border-red-500/60 text-red-400'
                  : 'border-yellow-400/60 text-yellow-400'
                }`}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
