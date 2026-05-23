# EduBattle - Interactive Real-time Quiz Platform

## 1. System Architecture
EduBattle is designed as a modern, high-performance web application consisting of a separated frontend and backend to enable real-time multiplayer features seamlessly.

- **Frontend**: Next.js 15 (App Router) + TypeScript
  - Styling: Tailwind CSS, Shadcn UI
  - Animations: Framer Motion
  - Real-time Client: Socket.io-client
  - PWA Support: next-pwa
- **Backend**: Node.js + Express
  - Real-time Server: Socket.IO
  - Database: PostgreSQL
  - ORM: Prisma
  - Authentication: JWT & Google OAuth

## 2. Gamification & Features
**Boss Battle Mode**
- A unique collaborative mode where all students answer questions simultaneously.
- Correct answers reduce the Boss's HP.
- Boss HP bar and attack animations implemented via Framer Motion.

**Role-Based Access**
- **Admin**: System management.
- **Guru**: Create/Manage quizzes, upload Excel/PDF, AI generate questions, start live sessions, monitor analytics.
- **Siswa**: Join via room code, level up, unlock avatars, battle in realtime.

**Anti-Cheat System**
- Fullscreen enforcement during exams.
- Tab switch detection (logs cheating attempts).
- Copy-paste blocked.

## 3. Database Schema (Prisma)
The database is structured to support all required features, including users, quizzes, realtime sessions, gamification (achievements, ranks), and analytics.
*Check `server/prisma/schema.prisma` for the full implementation.*

## 4. UI/UX Design System
- **Theme**: Modern Gaming Education (Glassmorphism, Neon Accents, Dark Mode).
- **Colors**: Deep purples/blues for background with vibrant neon pinks, cyans, and yellows for interactive elements.
- **Typography**: Inter (UI text) + Orbitron/Outfit (Headers & Gamified elements).
- **Animations**: Page transitions, hover effects, success/error feedback, and real-time leaderboard shuffling.

## 5. Directory Structure
```
d:/game-interaktif/
├── client/ (Next.js Frontend)
│   ├── src/
│   │   ├── app/ (Routes)
│   │   ├── components/ (Shadcn + Custom)
│   │   ├── lib/ (Utils, Socket client)
│   │   └── styles/
│   └── public/
├── server/ (Express + Socket.io Backend)
│   ├── prisma/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   └── socket/
│   └── package.json
└── ARCHITECTURE.md
```
