"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { GoogleOAuthProvider, GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { loginTeacher, loginStudent, registerTeacher, loginGoogle } from "@/lib/auth";

type Tab = "SISWA" | "LOGIN_GURU" | "DAFTAR_GURU";

interface FormState {
  name:            string;
  username:        string;
  password:        string;
  confirmPassword: string;
  displayName:     string;
  showPassword:    boolean;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function LoginPage() {
  const router  = useRouter();
  const [tab,     setTab]     = useState<Tab>("SISWA");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [form,    setForm]    = useState<FormState>({
    name:"", username:"", password:"", confirmPassword:"", displayName:"", showPassword:false,
  });

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const switchTab = (t: Tab) => { setTab(t); setError(""); };

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      if (tab === "SISWA") {
        if (!form.name.trim()) { setError("Masukkan nama hero kamu."); return; }
        await loginStudent(form.name.trim());
        router.push("/battle");

      } else if (tab === "LOGIN_GURU") {
        if (!form.username || !form.password) { setError("Username dan password wajib diisi."); return; }
        await loginTeacher(form.username.trim(), form.password);
        router.push("/dashboard");

      } else {
        if (!form.username || !form.displayName || !form.password || !form.confirmPassword) {
          setError("Semua field wajib diisi."); return;
        }
        if (form.password !== form.confirmPassword) {
          setError("Konfirmasi password tidak cocok."); return;
        }
        await registerTeacher(form.username.trim(), form.displayName.trim(), form.password, form.confirmPassword);
        router.push("/dashboard");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError("Login Google gagal — tidak ada credential."); return;
    }
    setLoading(true); setError("");
    try {
      await loginGoogle(credentialResponse.credential, tab === "SISWA" ? "SISWA" : "GURU");
      router.push(tab === "SISWA" ? "/battle" : "/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login Google gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* BG */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-[#0050a0] rounded-full blur-[160px] opacity-15" />
          <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-[#f5e642] rounded-full blur-[140px] opacity-4" />
          <div style={{ backgroundImage:"linear-gradient(rgba(0,212,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.04) 1px,transparent 1px)", backgroundSize:"50px 50px" }}
            className="absolute inset-0" />
        </div>

        <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }}
          className="glass-panel p-8 w-full max-w-md relative z-10">

          {/* Logo */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-xl border border-[#00d4ff]/40 bg-[#00d4ff]/10 flex items-center
              justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(0,212,255,0.25)]">
              <span className="text-2xl">🐉</span>
            </div>
            <h1 className="text-2xl font-bold font-['Orbitron'] tracking-wider">
              <span className="text-white">EDU</span><span className="neon-text-cyan">BATTLE</span>
            </h1>
            <p className="text-[#546e7a] text-xs mt-1">Platform belajar gamified terbaik</p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-lg overflow-hidden border border-[#00d4ff]/20 mb-6 text-[10px]">
            {([
              { key:"SISWA",      label:"🎮 Siswa"     },
              { key:"LOGIN_GURU", label:"👨‍🏫 Login Guru"  },
              { key:"DAFTAR_GURU",label:"✏️ Daftar Guru" },
            ] as const).map(t => (
              <button key={t.key} onClick={() => switchTab(t.key)}
                className={`flex-1 py-2.5 font-bold font-['Orbitron'] tracking-wider transition-all
                  ${tab === t.key
                    ? t.key === "SISWA"
                      ? "bg-[#00d4ff] text-[#050508]"
                      : "bg-[#f5e642] text-[#050508]"
                    : "bg-transparent text-[#546e7a] hover:text-[#a8bfd0] hover:bg-white/5"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                className="mb-4 bg-[#ff2a6d]/10 border border-[#ff2a6d]/40 text-[#ff2a6d] text-sm px-4 py-2.5 rounded-lg flex justify-between">
                <span>{error}</span>
                <button onClick={() => setError("")} className="ml-2 hover:text-white">✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── SISWA FORM ── */}
          <AnimatePresence mode="wait">
            {tab === "SISWA" && (
              <motion.div key="siswa" initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:10 }}
                className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-[#00d4ff] uppercase tracking-widest mb-1.5 block">Nama Hero</label>
                  <input className="w-full bg-[#0d1a2e]/80 border border-[#00d4ff]/30 rounded-lg p-3 text-white
                    focus:outline-none focus:border-[#00d4ff] transition placeholder:text-[#546e7a]"
                    placeholder="Masukkan nama hero kamu" value={form.name}
                    onChange={e => set("name", e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    maxLength={24} autoFocus />
                </div>
                <p className="text-xs text-[#546e7a]">Siswa tidak perlu password — cukup nama untuk bergabung arena.</p>
              </motion.div>
            )}

            {/* ── LOGIN GURU FORM ── */}
            {tab === "LOGIN_GURU" && (
              <motion.div key="login" initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:10 }}
                className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-[#f5e642] uppercase tracking-widest mb-1.5 block">Username</label>
                  <input className="w-full bg-[#0d1a2e]/80 border border-[#f5e642]/30 rounded-lg p-3 text-white
                    focus:outline-none focus:border-[#f5e642] transition placeholder:text-[#546e7a]"
                    placeholder="Username guru" value={form.username}
                    onChange={e => set("username", e.target.value)} maxLength={20} autoFocus />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#f5e642] uppercase tracking-widest mb-1.5 block">Password</label>
                  <div className="relative">
                    <input type={form.showPassword ? "text" : "password"}
                      className="w-full bg-[#0d1a2e]/80 border border-[#f5e642]/30 rounded-lg p-3 pr-10 text-white
                        focus:outline-none focus:border-[#f5e642] transition placeholder:text-[#546e7a]"
                      placeholder="Password" value={form.password}
                      onChange={e => set("password", e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                    <button type="button" onClick={() => set("showPassword", !form.showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#546e7a] hover:text-[#a8bfd0] text-sm">
                      {form.showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── DAFTAR GURU FORM ── */}
            {tab === "DAFTAR_GURU" && (
              <motion.div key="register" initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:10 }}
                className="space-y-3">
                {[
                  { label:"Username",           key:"username",      placeholder:"cth: pak_budi (huruf/angka/_)", type:"text"     },
                  { label:"Nama Lengkap",       key:"displayName",   placeholder:"Nama Anda",                    type:"text"     },
                  { label:"Password",           key:"password",      placeholder:"Minimal 6 karakter",           type:"password" },
                  { label:"Konfirmasi Password",key:"confirmPassword",placeholder:"Ulangi password",            type:"password" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] font-bold text-[#f5e642] uppercase tracking-widest mb-1.5 block">{f.label}</label>
                    <div className="relative">
                      <input
                        type={f.type === "password" ? (form.showPassword ? "text" : "password") : "text"}
                        className="w-full bg-[#0d1a2e]/80 border border-[#f5e642]/30 rounded-lg p-3 pr-10 text-white
                          focus:outline-none focus:border-[#f5e642] transition placeholder:text-[#546e7a] text-sm"
                        placeholder={f.placeholder}
                        value={form[f.key as keyof FormState] as string}
                        onChange={e => set(f.key as keyof FormState, e.target.value)}
                        maxLength={f.key === "username" ? 20 : 50} />
                      {f.type === "password" && (
                        <button type="button" onClick={() => set("showPassword", !form.showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#546e7a] hover:text-[#a8bfd0] text-sm">
                          {form.showPassword ? "🙈" : "👁️"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            onClick={handleSubmit} disabled={loading}
            className={`mt-6 w-full py-3 font-bold rounded-lg transition-all font-['Orbitron'] text-sm
              tracking-widest disabled:opacity-50 disabled:cursor-not-allowed
              ${tab === "SISWA"
                ? "bg-[#00d4ff] hover:bg-[#33e5ff] text-[#050508] neon-border-cyan"
                : "bg-[#f5e642] hover:bg-[#ffe800] text-[#050508] neon-border-pink"}`}>
            {loading ? "⏳ MEMUAT..." : tab === "SISWA" ? "MASUK ARENA" : tab === "LOGIN_GURU" ? "LOGIN" : "DAFTAR SEKARANG"}
          </motion.button>

          {/* Google Login divider */}
          {GOOGLE_CLIENT_ID && (
            <>
              <div className="mt-5 flex items-center gap-3">
                <div className="h-px bg-white/10 flex-1" />
                <span className="text-[10px] text-[#546e7a] uppercase font-bold tracking-widest">Atau lanjutkan dengan</span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <div className="mt-4 flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Login Google dibatalkan atau gagal.")}
                  theme="filled_black"
                  shape="pill"
                  size="large"
                  text="continue_with"
                  locale="id"
                />
              </div>
              <p className="text-[10px] text-[#546e7a] text-center mt-2">
                {tab === "SISWA" ? "Google login sebagai Siswa" : "Google login sebagai Guru"}
              </p>
            </>
          )}

          {/* Hints */}
          <p className="text-[10px] text-[#546e7a] text-center mt-4">
            {tab === "LOGIN_GURU" && (
              <span>Belum punya akun?{" "}
                <button onClick={() => switchTab("DAFTAR_GURU")} className="text-[#f5e642] hover:text-[#ffe800] underline font-bold">
                  Daftar di sini
                </button>
              </span>
            )}
            {tab === "DAFTAR_GURU" && (
              <span>Sudah punya akun?{" "}
                <button onClick={() => switchTab("LOGIN_GURU")} className="text-[#f5e642] hover:text-[#ffe800] underline font-bold">
                  Login di sini
                </button>
              </span>
            )}
          </p>
        </motion.div>
      </div>
    </GoogleOAuthProvider>
  );
}
