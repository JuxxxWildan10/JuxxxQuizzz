import type { Metadata } from 'next';
import { Inter, Orbitron } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/NavBar';
import ErrorBoundary from '@/components/ErrorBoundary';

const inter    = Inter({ subsets: ['latin'], variable: '--font-inter',    display: 'swap' });
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron', display: 'swap' });

export const metadata: Metadata = {
  title:       'EduBattle — Realtime Interactive Quiz',
  description: 'Platform belajar gamified terbaik. Boss Battle, Multiplayer Quiz, Global Ranks.',
  manifest:    '/manifest.json',
  keywords:    ['quiz', 'education', 'game', 'multiplayer', 'edubattle'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${orbitron.variable}`}>
      <body className="antialiased min-h-screen">
        <ErrorBoundary>
          <NavBar />
          <main className="min-h-[calc(100vh-64px)]">{children}</main>
          <footer className="border-t border-[#00d4ff]/10 py-5 text-center text-xs text-[#546e7a]">
            © 2025 EduBattle — Built for the next generation of learners 🐉
            <span className="mx-2">·</span>
            <a href="/practice" className="hover:text-[#00d4ff] transition">Practice</a>
            <span className="mx-2">·</span>
            <a href="/leaderboard" className="hover:text-[#00d4ff] transition">Ranking</a>
            <span className="mx-2">·</span>
            <a href="/profile" className="hover:text-[#00d4ff] transition">Profile</a>
          </footer>
        </ErrorBoundary>
      </body>
    </html>
  );
}
