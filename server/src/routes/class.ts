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

/* GET /api/classes — Get all classes for the teacher */
router.get('/', requireTeacher, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classes = await prisma.class.findMany({
      where: { teacherId: req.user!.id },
      include: {
        _count: {
          select: { students: true }
        }
      }
    });
    res.json(classes);
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal mengambil data kelas.' });
  }
});

/* POST /api/classes — Create a new class */
router.post('/', requireTeacher, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, schoolId } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Nama kelas wajib diisi.' }); return;
  }
  try {
    const newClass = await prisma.class.create({
      data: {
        name,
        schoolId: schoolId || null,
        teacherId: req.user!.id
      }
    });
    res.json(newClass);
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal membuat kelas.' });
  }
});

export default router;
