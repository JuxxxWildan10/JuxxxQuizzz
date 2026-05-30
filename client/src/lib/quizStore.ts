import { getToken } from './auth';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export interface QuizAnswer   { id?: string; text: string; isCorrect: boolean; }
export interface QuizQuestion { id?: string; text: string; answers: QuizAnswer[]; timeLimit: number; }
export interface Quiz         { id: string; title: string; questions: QuizQuestion[]; createdAt: string; mode: 'BOSS_BATTLE' | 'BATTLE_ROYALE' | 'TEAM_BATTLE'; roomCode?: string; }

export async function getQuizzes(): Promise<Quiz[]> {
  const token = getToken();
  if (!token) return [];
  try {
    const res = await fetch(`${SOCKET_URL}/api/quizzes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Gagal memuat kuis.');
    }
    return await res.json();
  } catch (err: unknown) {
    console.error('[QuizStore] Error fetching quizzes:', err);
    throw err;
  }
}

export async function saveQuiz(quiz: Quiz): Promise<Quiz> {
  const token = getToken();
  if (!token) throw new Error('Token tidak ditemukan. Harap login kembali.');

  const isSample = quiz.id.startsWith('sample-');

  if (!isSample) {
    // Try to update existing quiz — only fallback to create on 404 (quiz not found)
    try {
      const res = await fetch(`${SOCKET_URL}/api/quizzes/${quiz.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: quiz.title, questions: quiz.questions, mode: quiz.mode })
      });
      if (res.ok) {
        return await res.json();
      }
      // If it's an auth/forbidden error — throw immediately, don't silently create a duplicate
      if (res.status !== 404) {
        const data = await res.json();
        throw new Error(data.error || `Update gagal (${res.status}).`);
      }
      // 404: quiz not in DB yet (e.g. generated from AI with temp id), fall through to create
    } catch (e: unknown) {
      // Re-throw auth/forbidden errors; only swallow network errors
      if ((e as Error).message?.toLowerCase().includes('update gagal') ||
          (e as Error).message?.toLowerCase().includes('ditolak') ||
          (e as Error).message?.toLowerCase().includes('token')) {
        throw e;
      }
      console.warn('[QuizStore] Update failed with network error, attempting create.', e);
    }
  }

  // Create new quiz
  const res = await fetch(`${SOCKET_URL}/api/quizzes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ title: quiz.title, questions: quiz.questions, mode: quiz.mode })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal menyimpan kuis.');
  return data;
}

export async function deleteQuiz(id: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Token tidak ditemukan.');

  if (id.startsWith('sample-')) return;

  const res = await fetch(`${SOCKET_URL}/api/quizzes/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Gagal menghapus kuis.');
  }
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* Sample quiz pre-loaded for demo */
export const SAMPLE_QUIZ: Quiz = {
  id: 'sample-1',
  title: 'Demo: Pengetahuan Umum',
  mode: 'BOSS_BATTLE',
  createdAt: new Date().toISOString(),
  questions: [
    { id:'q1', text:'Ibu kota Prancis adalah?', timeLimit:30, answers:[
      {id:'a',text:'London',isCorrect:false},{id:'b',text:'Paris',isCorrect:true},
      {id:'c',text:'Berlin',isCorrect:false},{id:'d',text:'Roma',isCorrect:false}]},
    { id:'q2', text:'Berapa hasil dari 12 × 12?', timeLimit:30, answers:[
      {id:'a',text:'124',isCorrect:false},{id:'b',text:'144',isCorrect:true},
      {id:'c',text:'134',isCorrect:false},{id:'d',text:'148',isCorrect:false}]},
    { id:'q3', text:'Planet terdekat dengan Matahari?', timeLimit:30, answers:[
      {id:'a',text:'Venus',isCorrect:false},{id:'b',text:'Bumi',isCorrect:false},
      {id:'c',text:'Merkurius',isCorrect:true},{id:'d',text:'Mars',isCorrect:false}]},
    { id:'q4', text:'Simbol kimia untuk Emas?', timeLimit:30, answers:[
      {id:'a',text:'Au',isCorrect:true},{id:'Ag',text:'Ag',isCorrect:false},
      {id:'Fe',text:'Fe',isCorrect:false},{id:'Gd',text:'Gd',isCorrect:false}]},
    { id:'q5', text:'Siapa yang menemukan telepon?', timeLimit:30, answers:[
      {id:'a',text:'Edison',isCorrect:false},{id:'b',text:'Tesla',isCorrect:false},
      {id:'c',text:'Alexander Bell',isCorrect:true},{id:'d',text:'Faraday',isCorrect:false}]},
  ],
};
