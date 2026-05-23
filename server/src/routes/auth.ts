import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET  = process.env.JWT_SECRET  || 'edubattle-super-secret-2025';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const SALT_ROUNDS = 10;

import { prisma } from '../index';

/* ── Seed demo account into database ── */
(async () => {
  try {
    let demoTeacher = await prisma.user.findUnique({ where: { email: 'demo' } });
    if (!demoTeacher) {
      const hash = await bcrypt.hash('demo123', SALT_ROUNDS);
      demoTeacher = await prisma.user.create({
        data: {
          email: 'demo',
          password: hash,
          name: 'Demo Guru',
          role: 'GURU',
        },
      });
      console.log('[Auth] Demo account ready in database → username: demo | password: demo123');
    } else {
      console.log('[Auth] Demo account already exists in database.');
    }

    // Seed sample quiz
    const sampleQuiz = await prisma.quiz.findUnique({ where: { id: 'sample-1' } });
    if (!sampleQuiz) {
      await prisma.quiz.create({
        data: {
          id: 'sample-1',
          title: 'Demo: Pengetahuan Umum',
          creatorId: demoTeacher.id,
          questions: {
            create: [
              {
                id: 'q1', text: 'Ibu kota Prancis adalah?', timeLimit: 30,
                answers: {
                  create: [
                    { text: 'London', isCorrect: false },
                    { text: 'Paris', isCorrect: true },
                    { text: 'Berlin', isCorrect: false },
                    { text: 'Roma', isCorrect: false }
                  ]
                }
              },
              {
                id: 'q2', text: 'Berapa hasil dari 12 × 12?', timeLimit: 30,
                answers: {
                  create: [
                    { text: '124', isCorrect: false },
                    { text: '144', isCorrect: true },
                    { text: '134', isCorrect: false },
                    { text: '148', isCorrect: false }
                  ]
                }
              },
              {
                id: 'q3', text: 'Planet terdekat dengan Matahari?', timeLimit: 30,
                answers: {
                  create: [
                    { text: 'Venus', isCorrect: false },
                    { text: 'Bumi', isCorrect: false },
                    { text: 'Merkurius', isCorrect: true },
                    { text: 'Mars', isCorrect: false }
                  ]
                }
              },
              {
                id: 'q4', text: 'Simbol kimia untuk Emas?', timeLimit: 30,
                answers: {
                  create: [
                    { text: 'Au', isCorrect: true },
                    { text: 'Ag', isCorrect: false },
                    { text: 'Fe', isCorrect: false },
                    { text: 'Gd', isCorrect: false }
                  ]
                }
              },
              {
                id: 'q5', text: 'Siapa yang menemukan telepon?', timeLimit: 30,
                answers: {
                  create: [
                    { text: 'Edison', isCorrect: false },
                    { text: 'Tesla', isCorrect: false },
                    { text: 'Alexander Bell', isCorrect: true },
                    { text: 'Faraday', isCorrect: false }
                  ]
                }
              }
            ]
          }
        }
      });
      console.log('[Auth] Sample quiz seeded in database.');
    }
  } catch (err) {
    console.error('[Auth] Error seeding demo data:', err);
  }
})();

function makeToken(payload: Record<string, unknown>) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as jwt.SignOptions);
}

const router = Router();

/* POST /api/auth/register — Teacher registration */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { username, password, confirmPassword, name } = req.body as Record<string, string>;

  if (!username || !password || !name) {
    res.status(400).json({ error: 'Semua field wajib diisi.' }); return;
  }
  if (username.length < 3 || username.length > 20) {
    res.status(400).json({ error: 'Username 3–20 karakter.' }); return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    res.status(400).json({ error: 'Username hanya boleh huruf, angka, underscore.' }); return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password minimal 6 karakter.' }); return;
  }
  if (confirmPassword && password !== confirmPassword) {
    res.status(400).json({ error: 'Konfirmasi password tidak cocok.' }); return;
  }
  if (name.trim().length < 2) {
    res.status(400).json({ error: 'Nama minimal 2 karakter.' }); return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: username.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: 'Username sudah digunakan.' }); return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: username.toLowerCase(),
        password: passwordHash,
        name: name.trim(),
        role: 'GURU',
      },
    });

    const token = makeToken({ username: user.email, name: user.name, role: 'GURU' });
    res.status(201).json({ token, user: { username: user.email, name: user.name, role: 'GURU' } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Registrasi gagal.' });
  }
});

/* POST /api/auth/login/teacher — Teacher login */
router.post('/login/teacher', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as Record<string, string>;

  if (!username || !password) {
    res.status(400).json({ error: 'Username dan password wajib diisi.' }); return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: username.toLowerCase() } });
    if (!user || user.role !== 'GURU') {
      res.status(401).json({ error: 'Username tidak ditemukan.' }); return;
    }

    const valid = await bcrypt.compare(password, user.password || '');
    if (!valid) {
      res.status(401).json({ error: 'Password salah.' }); return;
    }

    const token = makeToken({ username: user.email, name: user.name, role: 'GURU' });
    res.json({ token, user: { username: user.email, name: user.name, role: 'GURU' } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login gagal.' });
  }
});

/* POST /api/auth/login/student — Student login (name only, no password) */
router.post('/login/student', async (req: Request, res: Response): Promise<void> => {
  const { name } = req.body as Record<string, string>;
  if (!name?.trim() || name.trim().length < 2) {
    res.status(400).json({ error: 'Nama minimal 2 karakter.' }); return;
  }

  const cleanName = name.trim();
  const email = `${cleanName.toLowerCase().replace(/\s+/g, '_')}@siswa.edubattle.local`;

  try {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: cleanName,
          role: 'SISWA',
          xp: 0,
          level: 1,
          rank: 'BRONZE',
        },
      });
    }

    const token = makeToken({ email: user.email, name: user.name, role: 'SISWA' });
    res.json({
      token,
      user: {
        name: user.name,
        role: 'SISWA',
        xp: user.xp,
        level: user.level,
        rank: user.rank,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login siswa gagal.' });
  }
});

/* GET /api/auth/verify — Verify token and get latest user data */
router.get('/verify', async (req: Request, res: Response): Promise<void> => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token tidak ditemukan.' }); return;
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    const email = decoded.username || decoded.email;
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: {
        achievements: { include: { achievement: true } },
        sessions: true
      }
    });
    if (!user) {
      res.status(401).json({ error: 'User tidak terdaftar.' }); return;
    }

    const gamesPlayed = user.sessions.length;
    const totalScore = user.sessions.reduce((acc, s) => acc + s.score, 0);
    const achievements = user.achievements.map(a => a.achievement.condition);

    res.json({
      valid: true,
      user: {
        name: user.name,
        role: user.role,
        username: user.role === 'GURU' ? user.email : undefined,
        xp: user.xp,
        level: user.level,
        rank: user.rank,
        gamesPlayed,
        totalScore,
        achievements
      },
    });
  } catch {
    res.status(401).json({ error: 'Token expired atau tidak valid.' });
  }
});

/* POST /api/auth/google — Google OAuth Login / Registration */
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  const { googleId, email, name, avatar, role } = req.body as Record<string, string>;

  if (!email || !googleId || !name) {
    res.status(400).json({ error: 'Data Google tidak lengkap.' }); return;
  }

  const cleanEmail = email.toLowerCase().trim();
  const assignedRole = role === 'GURU' ? 'GURU' : 'SISWA';

  try {
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email: cleanEmail }]
      }
    });

    if (!user) {
      // Register new user via Google
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: name.trim(),
          googleId,
          avatar: avatar || null,
          role: assignedRole,
          xp: 0,
          level: 1,
          rank: 'BRONZE',
        }
      });
    } else if (!user.googleId) {
      // Link existing account with Google ID
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, avatar: avatar || user.avatar }
      });
    }

    const token = makeToken({ email: user.email, name: user.name, role: user.role });
    res.json({
      token,
      user: {
        name: user.name,
        role: user.role,
        username: user.role === 'GURU' ? user.email : undefined,
        xp: user.xp,
        level: user.level,
        rank: user.rank,
        avatar: user.avatar
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login Google gagal.' });
  }
});

/* GET /api/auth/teachers — List registered teachers */
router.get('/teachers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await prisma.user.findMany({
      where: { role: 'GURU' },
      select: { email: true, name: true, createdAt: true },
    });
    res.json({
      count: list.length,
      teachers: list.map(t => ({ username: t.email, name: t.name, createdAt: t.createdAt })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil data guru.' });
  }
});

export default router;
