// Auth helpers — JWT-based for teachers, localStorage for students
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export interface User {
  name:      string;
  role:      'GURU' | 'SISWA';
  username?: string; // only for GURU
  xp?:       number;
  level?:    number;
  rank?:     string;
  gamesPlayed?: number;
  totalScore?:  number;
  achievements?: string[];
}

const USER_KEY  = 'edubattle_user';
const TOKEN_KEY = 'edubattle_token';

/* ── Read / Write ── */
export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); }
  catch { return null; }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function saveSession(user: User, token: string) {
  localStorage.setItem(USER_KEY,  JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
}

export function logout(): void {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

/* ── Teacher Login (bcrypt + JWT via API) ── */
export async function loginTeacher(
  username: string, password: string
): Promise<{ user: User; token: string }> {
  const res = await fetch(`${SOCKET_URL}/api/auth/login/teacher`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Login gagal.');
  const user: User = { name: data.user.name, role: 'GURU', username: data.user.username };
  saveSession(user, data.token);
  return { user, token: data.token };
}

/* ── Teacher Register ── */
export async function registerTeacher(
  username: string, name: string, password: string, confirmPassword: string
): Promise<{ user: User; token: string }> {
  const res = await fetch(`${SOCKET_URL}/api/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, name, password, confirmPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Registrasi gagal.');
  const user: User = { name: data.user.name, role: 'GURU', username: data.user.username };
  saveSession(user, data.token);
  return { user, token: data.token };
}

/* ── Student Login (name only — still gets a server token) ── */
export async function loginStudent(name: string): Promise<{ user: User; token: string }> {
  try {
    const res = await fetch(`${SOCKET_URL}/api/auth/login/student`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name }),
    });
    const data = await res.json();
    if (res.ok) {
      const user: User = {
        name: data.user.name,
        role: 'SISWA',
        xp: data.user.xp,
        level: data.user.level,
        rank: data.user.rank
      };
      saveSession(user, data.token);
      return { user, token: data.token };
    }
  } catch { /* fallback below */ }
  // Fallback: localStorage only if server unreachable
  const user: User = { name: name.trim(), role: 'SISWA' };
  saveSession(user, 'offline-student');
  return { user, token: 'offline-student' };
}


/* ── Verify token with server ── */
export async function verifyToken(): Promise<User | null> {
  const token = getToken();
  if (!token || token === 'offline-student') return getUser();
  try {
    const res = await fetch(`${SOCKET_URL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { logout(); return null; }
    const data = await res.json();
    const updatedUser = data.user as User;
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    return updatedUser;
  } catch {
    return getUser(); // offline — trust localStorage
  }
}

/* ── Legacy setUser (for compatibility) ── */
export function setUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
