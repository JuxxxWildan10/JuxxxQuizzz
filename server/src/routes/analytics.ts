import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

const JWT_SECRET = process.env.JWT_SECRET || 'edubattle-super-secret-2025';

interface AuthRequest extends Request {
  user?: { email: string; role: string; id: string; }
}

async function requireTeacher(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token tidak ditemukan.' }); return;
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    const email = decoded.username || decoded.email;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'GURU') {
      res.status(403).json({ error: 'Akses ditolak.' }); return;
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Sesi tidak valid.' });
  }
}

const router = Router();

/* GET /api/analytics/teacher — Get summary for all teacher's quizzes */
router.get('/teacher', requireTeacher, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get all rooms created for quizzes owned by this teacher
    const quizzes = await prisma.quiz.findMany({
      where: { creatorId: req.user!.id },
      select: { id: true }
    });
    
    const quizIds = quizzes.map(q => q.id);

    const rooms = await prisma.room.findMany({
      where: { quizId: { in: quizIds }, status: 'FINISHED' },
      include: {
        sessions: {
          include: { analytics: true, user: true }
        },
        quiz: true
      }
    });

    let totalStudents = 0;
    let totalCheating = 0;
    const roomStats = rooms.map(room => {
      const studentCount = room.sessions.length;
      totalStudents += studentCount;
      const cheatingCount = room.sessions.reduce((sum, s) => sum + (s.analytics?.cheatingAttempts || 0), 0);
      totalCheating += cheatingCount;

      return {
        roomCode: room.code,
        quizTitle: room.quiz.title,
        mode: room.mode,
        completedAt: room.updatedAt,
        studentCount,
        cheatingCount,
        topScore: room.sessions.length > 0 ? Math.max(...room.sessions.map(s => s.score)) : 0,
        avgScore: studentCount ? room.sessions.reduce((sum, s) => sum + s.score, 0) / studentCount : 0
      };
    });

    res.json({
      totalGamesHosted: rooms.length,
      totalStudents,
      totalCheatingAttempts: totalCheating,
      history: roomStats.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memuat analitik.' });
  }
});

export default router;
