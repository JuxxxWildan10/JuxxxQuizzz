import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

const JWT_SECRET = process.env.JWT_SECRET || 'edubattle-super-secret-2025';

interface AuthRequest extends Request {
  user?: {
    email: string;
    role: string;
    id: string;
  }
}

// Authentication middleware
async function authenticateUser(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token tidak ditemukan.' }); return;
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    const email = decoded.username || decoded.email;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Pengguna tidak ditemukan.' }); return;
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Sesi tidak valid.' });
  }
}

const router = Router();

/* GET /api/tournaments — List all tournaments */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const tournaments = await prisma.tournament.findMany({
      include: {
        entries: {
          include: { user: { select: { name: true, level: true, rank: true } } },
          orderBy: { score: 'desc' }
        }
      },
      orderBy: { startDate: 'desc' }
    });
    res.json(tournaments);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memuat turnamen.' });
  }
});

/* POST /api/tournaments — Create a dynamic tournament (Teacher only) */
router.post('/', authenticateUser, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user!.role !== 'GURU') {
    res.status(403).json({ error: 'Hanya Guru yang dapat membuat turnamen.' }); return;
  }

  const { title, description, startDate, endDate } = req.body as {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
  };

  if (!title?.trim() || !description?.trim() || !startDate || !endDate) {
    res.status(400).json({ error: 'Field kuis turnamen tidak lengkap.' }); return;
  }

  try {
    const tournament = await prisma.tournament.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'UPCOMING'
      }
    });
    res.status(201).json(tournament);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal membuat turnamen.' });
  }
});

/* POST /api/tournaments/:id/join — Student join/submit score to a tournament */
router.post('/:id/join', authenticateUser, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { score } = req.body as { score: number };

  if (typeof score !== 'number') {
    res.status(400).json({ error: 'Skor wajib angka valid.' }); return;
  }

  try {
    const tournament = await prisma.tournament.findUnique({ where: { id } });
    if (!tournament) {
      res.status(404).json({ error: 'Turnamen tidak ditemukan.' }); return;
    }

    const now = new Date();
    if (now < new Date(tournament.startDate) || now > new Date(tournament.endDate)) {
      res.status(400).json({ error: 'Turnamen belum dimulai atau sudah selesai.' }); return;
    }

    // Check if entry already exists
    const existing = await prisma.tournamentEntry.findFirst({
      where: { tournamentId: id, userId: req.user!.id }
    });

    if (existing) {
      // Save highest score achieved
      const updated = await prisma.tournamentEntry.update({
        where: { id: existing.id },
        data: { score: Math.max(existing.score, score) }
      });
      res.json(updated);
    } else {
      const entry = await prisma.tournamentEntry.create({
        data: {
          tournamentId: id,
          userId: req.user!.id,
          score
        }
      });
      res.status(201).json(entry);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menyimpan skor turnamen.' });
  }
});

export default router;
