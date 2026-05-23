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
      res.status(403).json({ error: 'Akses ditolak. Hanya untuk Guru.' }); return;
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Sesi tidak valid.' });
  }
}

const router = Router();

/* GET /api/quizzes — Get all quizzes created by teacher */
router.get('/', requireTeacher, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { creatorId: req.user!.id },
      include: {
        questions: {
          include: { answers: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(quizzes);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memuat kuis.' });
  }
});

/* POST /api/quizzes — Create a new quiz */
router.post('/', requireTeacher, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, questions } = req.body as { title: string; questions: any[] };
  if (!title?.trim() || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: 'Data kuis tidak lengkap.' }); return;
  }

  try {
    const quiz = await prisma.quiz.create({
      data: {
        title: title.trim(),
        creatorId: req.user!.id,
        questions: {
          create: questions.map(q => ({
            text: q.text,
            timeLimit: q.timeLimit || 30,
            answers: {
              create: q.answers.map((a: any) => ({
                text: a.text,
                isCorrect: !!a.isCorrect
              }))
            }
          }))
        }
      },
      include: {
        questions: {
          include: { answers: true }
        }
      }
    });
    res.status(201).json(quiz);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menyimpan kuis.' });
  }
});

/* PUT /api/quizzes/:id — Update an existing quiz */
router.put('/:id', requireTeacher, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { title, questions } = req.body as { title: string; questions: any[] };
  if (!title?.trim() || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: 'Data kuis tidak lengkap.' }); return;
  }

  try {
    const existing = await prisma.quiz.findUnique({ where: { id } });
    if (!existing || existing.creatorId !== req.user!.id) {
      res.status(404).json({ error: 'Kuis tidak ditemukan atau akses ditolak.' }); return;
    }

    const updatedQuiz = await prisma.$transaction(async (tx) => {
      // Find all question IDs of this quiz
      const questionIds = await tx.question.findMany({
        where: { quizId: id },
        select: { id: true }
      });
      const qIds = questionIds.map(q => q.id);

      // Delete their answers
      await tx.answer.deleteMany({
        where: { questionId: { in: qIds } }
      });

      // Delete questions
      await tx.question.deleteMany({
        where: { quizId: id }
      });

      // Update quiz title and re-create questions/answers
      return tx.quiz.update({
        where: { id },
        data: {
          title: title.trim(),
          questions: {
            create: questions.map(q => ({
              text: q.text,
              timeLimit: q.timeLimit || 30,
              answers: {
                create: q.answers.map((a: any) => ({
                  text: a.text,
                  isCorrect: !!a.isCorrect
                }))
              }
            }))
          }
        },
        include: {
          questions: {
            include: { answers: true }
          }
        }
      });
    });

    res.json(updatedQuiz);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memperbarui kuis.' });
  }
});

/* DELETE /api/quizzes/:id — Delete a quiz */
router.delete('/:id', requireTeacher, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  try {
    const existing = await prisma.quiz.findUnique({ where: { id } });
    if (!existing || existing.creatorId !== req.user!.id) {
      res.status(404).json({ error: 'Kuis tidak ditemukan atau akses ditolak.' }); return;
    }

    await prisma.$transaction(async (tx) => {
      const questionIds = await tx.question.findMany({
        where: { quizId: id },
        select: { id: true }
      });
      const qIds = questionIds.map(q => q.id);

      await tx.answer.deleteMany({ where: { questionId: { in: qIds } } });
      await tx.question.deleteMany({ where: { quizId: id } });
      await tx.quiz.delete({ where: { id } });
    });

    res.json({ message: 'Kuis berhasil dihapus.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menghapus kuis.' });
  }
});

export default router;
