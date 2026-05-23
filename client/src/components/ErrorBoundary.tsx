"use client";

import React from "react";

interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="glass-panel p-8 max-w-lg text-center border border-[#ff2a6d]/40">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold font-['Orbitron'] text-[#ff2a6d] mb-3">SYSTEM ERROR</h2>
            <p className="text-[#a8bfd0] text-sm mb-2">{this.state.error?.message}</p>
            <p className="text-[#546e7a] text-xs mb-6">Terjadi error yang tidak terduga. Refresh halaman untuk melanjutkan.</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-6 py-3 bg-[#00d4ff] hover:bg-[#33e5ff] text-[#050508] font-bold rounded-lg
                transition neon-border-cyan font-['Orbitron'] text-sm"
            >
              🔄 RELOAD
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
