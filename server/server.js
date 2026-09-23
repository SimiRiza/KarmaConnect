import { prepareImpact } from './services/impactMigration.js';
import { listImpactRecords } from './services/impactCalculations.js';
import { authenticate } from './middleware/auth.js';
import { endpoint } from './controllers/teamController.js';
import teamRoutes from './routes/teamRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import { prepareTeams } from './services/teamService.js';
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import { prepareNgoIndexes } from './utils/ngoIndexes.js';
import csrRoutes from './routes/csrRoutes.js';
import Funding from './models/Funding.js';
import ngoRoutes from './routes/ngoRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled in dev for local assets
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS Configuration
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Not allowed by Access-Control-Allow-Origin'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key']
  })
);

// 3. Request Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 4. Sanitize against NoSQL injection
app.use(
  mongoSanitize({
    replaceWith: '_'
  })
);

// 5. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'KarmaConnect API'
  });
});

// 6. Static uploads and Feature Routes
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/ngo', ngoRoutes);
app.use('/api/csr', csrRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.get('/api/impact-records', authenticate, endpoint(r => listImpactRecords(r.query))); 

// 7. 404 Handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route '${req.originalUrl}' not found.`
  });
});

// 8. Centralized Error Handling Middleware
app.use(errorHandler);

// 9. Start Server only when executed directly
if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
  connectDB().then(async () => {
    await prepareNgoIndexes();
    await Funding.createIndexes();
    await prepareTeams();
    await prepareImpact();
    app.listen(PORT, () => {
      console.log(`🚀 KarmaConnect Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    });
  }).catch(async error => { console.error('Database initialization failed:', error.message); await disconnectDB(); process.exitCode = 1; });
}

export default app;
