import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

const JWT_SECRET = process.env.JWT_SECRET || 'edubattle-super-secret-2025';

interface AuthRequest extends Request {
  user?: { email: string; role: string; id: string; }
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token tidak ditemukan.' }); return;
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    const email = decoded.username || decoded.email;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(403).json({ error: 'Akses ditolak.' }); return;
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Sesi tidak valid.' });
  }
}

const router = Router();

/* POST /api/transactions/buy-quiz — Purchase a premium quiz */
router.post('/buy-quiz', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { quizId } = req.body;
  if (!quizId) {
    res.status(400).json({ error: 'Quiz ID wajib disertakan.' }); return;
  }
  try {
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz || !quiz.isPremium) {
      res.status(400).json({ error: 'Kuis tidak ditemukan atau bukan kuis premium.' }); return;
    }

    // This is where Stripe/Midtrans integration would happen.
    // For now, we simulate a successful transaction directly.
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user!.id,
        quizId: quiz.id,
        amount: quiz.price,
        status: 'SUCCESS' // Simulated success
      }
    });

    res.json({ message: 'Pembelian berhasil!', transaction });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal memproses transaksi.' });
  }
});

/* GET /api/transactions/history — Get user's transaction history */
router.get('/history', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const history = await prisma.transaction.findMany({
      where: { userId: req.user!.id },
      include: {
        quiz: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal mengambil riwayat transaksi.' });
  }
});

export default router;
