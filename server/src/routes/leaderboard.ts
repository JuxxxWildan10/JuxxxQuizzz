import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

/* GET /api/leaderboard — Get top 20 players ranked by XP */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const topUsers = await prisma.user.findMany({
      where: { role: 'SISWA' },
      orderBy: { xp: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        xp: true,
        level: true,
        rank: true,
        avatar: true,
      }
    });

    // Compute or default additional metadata to match frontend expectations
    const leaderboard = topUsers.map((user, index) => ({
      rank: index + 1,
      name: user.name,
      score: user.xp, // Score directly relates to accumulated XP
      level: user.level,
      tier: user.rank,
      avatar: user.avatar || '⚔️',
      streak: user.xp > 2000 ? 5 : user.xp > 500 ? 2 : 0, // dynamic streak estimation
    }));

    res.json(leaderboard);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil data peringkat.' });
  }
});

export default router;
