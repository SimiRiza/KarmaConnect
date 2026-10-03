import { proxyTrust } from './config/environment.js';
import { uploadsDirectory } from './config/storage.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { adminRoutes, trustRoutes } from './routes/trustRoutes.js';
import { prepareTrust } from './services/trustService.js';
import { prepareImpact } from './services/impactMigration.js';
import { listImpactRecords } from './services/impactCalculations.js';
import { authenticate } from './middleware/auth.js';
import { endpoint } from './controllers/teamController.js';
import teamRoutes from './routes/teamRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import { prepareTeams } from './services/teamService.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { connectDB, disconnectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import { prepareNgoIndexes } from './utils/ngoIndexes.js';
import csrRoutes from './routes/csrRoutes.js';
import Funding from './models/Funding.js';
import ngoRoutes from './routes/ngoRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
try {
  app.set('trust proxy', proxyTrust());
} catch {
  throw new Error('Invalid TRUST_PROXY: configure trusted proxy IP addresses/subnets or leave it unset.');
}
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Frontend policy needs testing against actual deployed asset origins.
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS Configuration
const allowedOrigins = [CLIENT_URL];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(Object.assign(new Error('CORS policy: Origin not allowed.'), { statusCode: 403 }));
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
app.use('/uploads', express.static(uploadsDirectory));
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', trustRoutes);
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
    await prepareTrust();
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
