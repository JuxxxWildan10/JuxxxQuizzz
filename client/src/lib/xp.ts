// XP, Level, Rank, Achievement system — localStorage-based
import { getUser } from './auth';
export interface UserProgress {
  xp: number; level: number; rank: string;
  achievements: string[]; gamesPlayed: number; totalScore: number;
}

export interface Achievement {
  id: string; name: string; desc: string; icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id:'first-battle',  name:'Warrior',      desc:'Selesaikan game pertama',      icon:'⚔️' },
  { id:'combo-5',       name:'On Fire',       desc:'Capai 5x combo streak',        icon:'🔥' },
  { id:'combo-10',      name:'Inferno',       desc:'Capai 10x combo streak',       icon:'💥' },
  { id:'speed-demon',   name:'Speed Demon',   desc:'Jawab dalam < 3 detik',        icon:'⚡' },
  { id:'perfect',       name:'Flawless',      desc:'Jawab semua soal benar',       icon:'🛡️' },
  { id:'dragon-slayer', name:'Dragon Slayer', desc:'Kalahkan boss pertama',        icon:'🐉' },
  { id:'top-1',         name:'Champion',      desc:'Peringkat #1 dalam 1 game',    icon:'👑' },
  { id:'play-10',       name:'Veteran',       desc:'Selesaikan 10 game',           icon:'🏅' },
  { id:'level-5',       name:'Rising Star',   desc:'Capai level 5',               icon:'⭐' },
  { id:'level-10',      name:'Legend',        desc:'Capai level 10',              icon:'🌟' },
];

const RANKS = [
  { name:'BRONZE',   minXP:0     },
  { name:'SILVER',   minXP:1000  },
  { name:'GOLD',     minXP:5000  },
  { name:'PLATINUM', minXP:15000 },
  { name:'MYTHIC',   minXP:50000 },
];

export function getLevel(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 50)));
}
export function getRank(xp: number): string {
  return [...RANKS].reverse().find(r => xp >= r.minXP)?.name ?? 'BRONZE';
}
export function xpToNextLevel(level: number): number {
  return (level + 1) * (level + 1) * 50;
}
export function xpProgress(xp: number): number {
  const lvl     = getLevel(xp);
  const current = lvl * lvl * 50;
  const next    = xpToNextLevel(lvl);
  return Math.min(100, ((xp - current) / (next - current)) * 100);
}

const KEY = 'edubattle_progress';

export function getProgress(): UserProgress {
  if (typeof window === 'undefined') return { xp:0, level:1, rank:'BRONZE', achievements:[], gamesPlayed:0, totalScore:0 };
  const user = getUser();
  const local = (() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); }
    catch { return null; }
  })();
  const p = local ?? { xp:0, level:1, rank:'BRONZE', achievements:[], gamesPlayed:0, totalScore:0 };
  
  if (user && user.role === 'SISWA') {
    return {
      ...p,
      xp: user.xp ?? p.xp,
      level: user.level ?? p.level,
      rank: user.rank ?? p.rank
    };
  }
  return p;
}

export function addXP(amount: number, scoreGained = 0): { before: UserProgress; after: UserProgress; leveledUp: boolean } {
  const before = getProgress();
  const after: UserProgress = {
    xp:          before.xp + amount,
    level:       getLevel(before.xp + amount),
    rank:        getRank(before.xp + amount),
    achievements: before.achievements,
    gamesPlayed: before.gamesPlayed + 1,
    totalScore:  before.totalScore + scoreGained,
  };
  localStorage.setItem(KEY, JSON.stringify(after));

  const user = getUser();
  if (user && user.role === 'SISWA') {
    user.xp = after.xp;
    user.level = after.level;
    user.rank = after.rank;
    localStorage.setItem('edubattle_user', JSON.stringify(user));
  }

  return { before, after, leveledUp: after.level > before.level };
}

/** Returns true if newly unlocked */
export function unlockAchievement(id: string): boolean {
  const p = getProgress();
  if (p.achievements.includes(id)) return false;
  p.achievements = [...p.achievements, id];
  localStorage.setItem(KEY, JSON.stringify(p));
  return true;
}

export function calcXPFromGame(score: number, rank: number, isWin: boolean): number {
  const base   = Math.floor(score / 10);
  const rankB  = rank === 1 ? 100 : rank === 2 ? 60 : rank === 3 ? 40 : 20;
  const winB   = isWin ? 50 : 0;
  return Math.max(10, base + rankB + winB);
}
