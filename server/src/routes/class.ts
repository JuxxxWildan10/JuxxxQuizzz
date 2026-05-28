import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
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

/* POST /api/classes/:id/students/bulk — Import students in bulk */
router.post('/:id/students/bulk', requireTeacher, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { students } = req.body; // array of { name: string }

  if (!students || !Array.isArray(students)) {
    res.status(400).json({ error: 'Daftar siswa wajib diisi dalam bentuk array.' }); return;
  }

  try {
    const classId = typeof id === 'string' ? id : String(id);
    // Verify class ownership
    const classData = await prisma.class.findFirst({
      where: { id: classId, teacherId: req.user!.id }
    });

    if (!classData) {
      res.status(404).json({ error: 'Kelas tidak ditemukan atau Anda tidak memiliki akses.' }); return;
    }

    // Process students (Upsert to User table, then connect to class)
    // For Enterprise scale, SQLite does not support createMany skipDuplicates, so we map into transaction
    const generatedCredentials: { name: string, email: string, pin: string }[] = [];

    const upsertQueries = students.map((s: { name: string }) => {
      const email = `${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}@siswa.edubattle.local`;
      const pin = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit PIN
      const hashedPin = bcrypt.hashSync(pin, 10);
      
      generatedCredentials.push({ name: s.name, email, pin });

      return prisma.user.upsert({
        where: { email },
        update: { password: hashedPin }, // Reset PIN if exists
        create: {
          email,
          name: s.name,
          password: hashedPin,
          role: 'SISWA',
          xp: 0,
          level: 1,
          rank: 'BRONZE'
        }
      });
    });

    const savedStudents = await prisma.$transaction(upsertQueries);

    // Connect to Class
    await prisma.class.update({
      where: { id: classId },
      data: {
        students: {
          connect: savedStudents.map(s => ({ id: s.id }))
        }
      }
    });

    res.json({ 
      message: `Berhasil mengimpor ${savedStudents.length} siswa ke kelas.`, 
      importedCount: savedStudents.length,
      credentials: generatedCredentials // Send back to Teacher so they can export/print it
    });
  } catch (err: any) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Gagal mengimpor siswa.' });
  }
});

export default router;
