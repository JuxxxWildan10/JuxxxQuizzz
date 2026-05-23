import { Router, Request, Response, NextFunction } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

// Helper to generate procedural fallback questions if Gemini API key is missing or calls fail
function generateFallbackQuestions(topic: string, count: number) {
  const questions = [];
  const templates = [
    {
      text: "Apa konsep dasar terpenting dari {topic}?",
      answers: [
        { text: "Implementasi standar industri {topic}", isCorrect: true },
        { text: "Definisi usang dari {topic}", isCorrect: false },
        { text: "Pembatasan performa sistem {topic}", isCorrect: false },
        { text: "Penghapusan log data {topic}", isCorrect: false }
      ]
    },
    {
      text: "Manakah yang merupakan pilar fundamental dalam {topic}?",
      answers: [
        { text: "Analisis teoretis dan eksperimental", isCorrect: true },
        { text: "Interferensi sinyal analog radio", isCorrect: false },
        { text: "Bahan casing server utama", isCorrect: false },
        { text: "Jumlah port kabel fisik", isCorrect: false }
      ]
    },
    {
      text: "Bagaimana cara kerja utama dari teknologi {topic}?",
      answers: [
        { text: "Mengotomasi pemrosesan informasi secara efisien", isCorrect: true },
        { text: "Menurunkan kecepatan CPU secara manual", isCorrect: false },
        { text: "Menyimpan data di media fisik kuno", isCorrect: false },
        { text: "Membatasi koneksi bandwidth internet", isCorrect: false }
      ]
    },
    {
      text: "Mengapa adaptasi {topic} sangat penting di era modern?",
      answers: [
        { text: "Meningkatkan skalabilitas dan efisiensi operasional", isCorrect: true },
        { text: "Mengurangi memori RAM secara paksa", isCorrect: false },
        { text: "Menghilangkan kebutuhan backup data", isCorrect: false },
        { text: "Menghindari penggunaan perangkat nirkabel", isCorrect: false }
      ]
    }
  ];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    // Map with unique IDs
    const qId = `q_fb_${Date.now()}_${i}`;
    questions.push({
      id: qId,
      text: template.text.replace(/{topic}/g, topic) + ` (Bagian ${Math.floor(i / templates.length) + 1})`,
      timeLimit: 30,
      answers: template.answers.map((a, ai) => ({
        id: `${qId}_ans_${ai}`,
        text: a.text.replace(/{topic}/g, topic),
        isCorrect: a.isCorrect
      }))
    });
  }
  return questions;
}

router.post('/generate', requireTeacher, async (req: AuthRequest, res: Response): Promise<void> => {
  const { topic, count } = req.body as { topic: string; count: number };
  
  if (!topic || !topic.trim()) {
    res.status(400).json({ error: "Topik wajib diisi." });
    return;
  }
  
  const questionCount = Math.min(Math.max(Number(count) || 5, 1), 30); // clamp between 1 and 30 questions

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.log(`[AI Route] API Key missing, using high-quality procedural fallback for ${questionCount} questions on: ${topic}`);
    res.json({
      title: `Kuis AI: ${topic}`,
      questions: generateFallbackQuestions(topic, questionCount)
    });
    return;
  }

  // List of models to try in descending order of availability
  const modelsToTry = [
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite"
  ];

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[AI Route] Attempting generation using model: ${modelName}`);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `Buatkan kuis pilihan ganda bertema "${topic}" sebanyak ${questionCount} soal.
Setiap soal harus memiliki tepat 4 pilihan jawaban dengan hanya satu jawaban yang benar.
Gunakan format output JSON dengan struktur seperti ini:
{
  "title": "Nama Kuis",
  "questions": [
    {
      "text": "Pertanyaan soal",
      "timeLimit": 30,
      "answers": [
        {"text": "Pilihan A", "isCorrect": false},
        {"text": "Pilihan B", "isCorrect": true},
        {"text": "Pilihan C", "isCorrect": false},
        {"text": "Pilihan D", "isCorrect": false}
      ]
    }
  ]
}
Harap pastikan output HANYA berupa JSON valid sesuai dengan struktur di atas.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const parsedData = JSON.parse(text);
      
      if (parsedData && Array.isArray(parsedData.questions)) {
        const formattedQuestions = parsedData.questions.map((q: any, qIdx: number) => {
          const qId = `q_ai_${Date.now()}_${qIdx}`;
          return {
            id: qId,
            text: q.text || "Pertanyaan Kuis",
            timeLimit: q.timeLimit || 30,
            answers: (Array.isArray(q.answers) ? q.answers : []).slice(0, 4).map((ans: any, aIdx: number) => ({
              id: `${qId}_ans_${aIdx}`,
              text: ans.text || `Pilihan ${aIdx + 1}`,
              isCorrect: !!ans.isCorrect
            }))
          };
        });

        console.log(`[AI Route] Successfully generated ${formattedQuestions.length} questions using ${modelName}`);

        try {
          // Save to database directly
          const savedQuiz = await prisma.quiz.create({
            data: {
              title: parsedData.title || `Kuis AI: ${topic}`,
              creatorId: req.user!.id,
              questions: {
                create: formattedQuestions.map((q: any) => ({
                  text: q.text,
                  timeLimit: q.timeLimit || 30,
                  answers: {
                    create: q.answers.map((a: any) => ({
                      text: a.text,
                      isCorrect: a.isCorrect
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

          res.json({
            id: savedQuiz.id,
            title: savedQuiz.title,
            questions: savedQuiz.questions.map(q => ({
              id: q.id,
              text: q.text,
              timeLimit: q.timeLimit,
              answers: q.answers.map(a => ({
                id: a.id,
                text: a.text,
                isCorrect: a.isCorrect
              }))
            }))
          });
          return;
        } catch (dbErr) {
          console.error("Failed to save AI quiz to DB", dbErr);
          res.json({
            title: parsedData.title || `Kuis AI: ${topic}`,
            questions: formattedQuestions
          });
          return;
        }
      }
      
      throw new Error("Format output Gemini tidak sesuai");

    } catch (err: any) {
      console.warn(`[AI Route] Model ${modelName} failed:`, err.message || err);
      lastError = err;
    }
  }

  // If all models failed (e.g. Rate Limit / Quota Exceeded)
  console.log(`[AI Route] All model attempts failed or quota exceeded. Falling back to procedural questions.`);
  res.json({
    title: `Kuis AI: ${topic}`,
    questions: generateFallbackQuestions(topic, questionCount),
    warning: "Menggunakan fallback karena kegagalan quota API Gemini.",
    errorDetails: lastError?.message || lastError
  });
});

export default router;
