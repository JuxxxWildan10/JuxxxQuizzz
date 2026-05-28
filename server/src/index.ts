import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { setupSocketHandlers } from './socket';
import authRoutes from './routes/auth';
import aiRoutes from './routes/ai';
import quizRoutes from './routes/quiz';
import leaderboardRoutes from './routes/leaderboard';
import tournamentRoutes from './routes/tournament';
import analyticsRoutes from './routes/analytics';
import classRoutes from './routes/class';
import transactionRoutes from './routes/transaction';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

dotenv.config();

const app = express();
const server = http.createServer(app);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return cb(null, true);
    if (process.env.NODE_ENV !== 'production') return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV !== 'production' ? '*' : ALLOWED_ORIGINS,
    methods: ['GET', 'POST']
  }
});

// Redis Adapter for Horizontal Scaling (Enterprise B2B)
if (process.env.REDIS_URL) {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Redis Adapter connected for Horizontal Scaling');
  }).catch(err => {
    console.error('Redis Adapter connection failed:', err);
  });
}

export const prisma = new PrismaClient();

app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/transactions', transactionRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'EduBattle Realtime Server is running!' });
});

// Setup Socket.IO
setupSocketHandlers(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
