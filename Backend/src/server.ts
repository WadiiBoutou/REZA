import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { prisma } from './lib/prisma';
import * as log from './utils/logger';
import { initRealtime } from './utils/realtime';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import publicRoutes from './modules/public/public.routes';
import tenantRoutes from './modules/tenant/tenant.routes';
import clientRoutes from './modules/client/client.routes';
import serviceRoutes from './modules/service/service.routes';
import employeeRoutes from './modules/employee/employee.routes';
import appointmentRoutes from './modules/appointment/appointment.routes';
import invoiceRoutes from './modules/invoice/invoice.routes';
import reviewRoutes from './modules/review/review.routes';
import statsRoutes from './modules/stats/stats.routes';
import cashTransactionRoutes from './modules/cash-transaction/cashTransaction.routes';
import notificationRoutes from './modules/notification/notification.routes';
import availabilityRoutes from './modules/availability/availability.routes';
import familyMemberRoutes from './modules/family-member/familyMember.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import salonRoutes from './modules/salon/salon.routes';
import subscriptionRoutes from './modules/subscription/subscription.routes';
import superAdminRoutes from './modules/superadmin/superadmin.routes';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/authenticateRequest';
import { tenantMiddleware } from './middleware/tenantMiddleware';

const staffMiddleware = [authMiddleware, tenantMiddleware];

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - production-safe
// Support both comma-separated and individual environment variables
const parseOrigins = (envVar: string | undefined): string[] => {
  if (!envVar) return [];
  return envVar.split(',').map(url => url.trim()).filter(Boolean);
};

const allowedOrigins = [
  ...parseOrigins(process.env.FRONTEND_URL),
  process.env.PRO_APP_URL,
  process.env.CLIENT_APP_URL,
  process.env.CLIENT_URL, // Also check CLIENT_URL
  // Always allow localhost for local development/testing (safe since localhost is only accessible locally)
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
].filter(Boolean); // Remove undefined values

// Use allowedOrigins for both development and production
const corsOrigins = allowedOrigins;

log.log('🔒 CORS allowed origins:', corsOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // In production, reject unknown origins when CORS is configured
    if (process.env.NODE_ENV === 'production' && corsOrigins.length === 0) {
      log.warn('🚫 CORS blocked origin (no FRONTEND_URL configured):', origin);
      return callback(new Error('CORS is not configured for this environment'));
    }

    if (corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      log.warn('🚫 CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-salon-ids']
}));

// Increase body parser limit for photo uploads (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from public directory with CORS headers
// Path resolution: __dirname is 'dist' in production (compiled from src)
// Files are saved to public/uploads at the root of the project
const publicUploadsPath = path.resolve(__dirname, '..', 'public', 'uploads');

// Ensure the uploads directory exists
if (!fs.existsSync(publicUploadsPath)) {
  fs.mkdirSync(publicUploadsPath, { recursive: true });
  log.log(`📁 Created uploads directory: ${publicUploadsPath}`);
}

const salonUploadsPath = path.join(publicUploadsPath, 'salons');
if (!fs.existsSync(salonUploadsPath)) {
  fs.mkdirSync(salonUploadsPath, { recursive: true });
  log.log(`📁 Created salon uploads directory: ${salonUploadsPath}`);
}

log.log(`📂 Serving static files from: ${publicUploadsPath}`);

app.use('/uploads', (req, res, next) => {
  // Set CORS headers to allow cross-origin access to images
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
}, express.static(publicUploadsPath, {
  // Enable etag for caching
  etag: true,
  // Enable last-modified for caching
  lastModified: true,
  // Set max age for cache control
  maxAge: '1d',
  // Set content type for images
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.png') || filePath.endsWith('.gif') || filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', `image/${filePath.split('.').pop()}`);
    }
  }
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
// Public routes (no authentication required)
app.use('/api/public', publicRoutes);
app.use('/api/public/availability', availabilityRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/salons', salonRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/clients', ...staffMiddleware, clientRoutes);
app.use('/api/services', ...staffMiddleware, serviceRoutes);
app.use('/api/employees', ...staffMiddleware, employeeRoutes);
app.use('/api/appointments', ...staffMiddleware, appointmentRoutes);
app.use('/api/invoices', ...staffMiddleware, invoiceRoutes);
app.use('/api/reviews', ...staffMiddleware, reviewRoutes);
app.use('/api/stats', ...staffMiddleware, statsRoutes);
app.use('/api/cash-transactions', ...staffMiddleware, cashTransactionRoutes);
app.use('/api/notifications', ...staffMiddleware, notificationRoutes);
app.use('/api/family-members', ...staffMiddleware, familyMemberRoutes);
app.use('/api/dashboard', ...staffMiddleware, dashboardRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(Number(PORT), '0.0.0.0', () => {
  log.log(`🚀 Server running on port ${PORT}`);
  log.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

  if (process.env.NODE_ENV !== 'production') {
    updateMobileIp();
  }
});

// Real-time notifications (Socket.IO) — attach to the same HTTP server
initRealtime(server);

function updateMobileIp() {
  // Resolve the LAN IP from network interfaces
  const nets = os.networkInterfaces();
  let localIp = '127.0.0.1';
  for (const ifaces of Object.values(nets)) {
    for (const iface of (ifaces ?? [])) {
      if (!iface.internal && iface.family === 'IPv4') {
        localIp = iface.address;
        break;
      }
    }
    if (localIp !== '127.0.0.1') break;
  }

  // Set up adb reverse port forwarding so physical phones can reach
  // the backend via 127.0.0.1:5000 over USB — no LAN IP needed.
  const { exec } = require('child_process');
  exec('adb reverse tcp:5000 tcp:5000', (err: Error | null, stdout: string, stderr: string) => {
    if (err) {
      console.log('📱 adb reverse not set (no device connected or adb not found) — plug in your phone and restart the server');
    } else {
      console.log('📱 adb reverse tcp:5000 → tcp:5000 — phone can reach backend via localhost:5000');
    }
  });

  const dartContent = `// AUTO-GENERATED BY BACKEND\n// DO NOT EDIT MANUALLY\nconst String autoLocalIp = '${localIp}';\n`;
  const clientPath = path.resolve(__dirname, '../../Mobile/reza_client_mobile/lib/config/auto_ip.dart');
  const proPath = path.resolve(__dirname, '../../Mobile/reza_pro_mobile/lib/config/auto_ip.dart');

  try {
    if (fs.existsSync(path.dirname(clientPath))) {
      fs.writeFileSync(clientPath, dartContent);
    }
    if (fs.existsSync(path.dirname(proPath))) {
      fs.writeFileSync(proPath, dartContent);
    }
    log.log(`📱 Mobile apps updated with LAN IP: ${localIp}`);
  } catch (err) {
    log.error('Failed to update mobile IPs:', err);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    log.log('HTTP server closed');
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  log.log('SIGINT signal received: closing HTTP server');
  server.close(async () => {
    log.log('HTTP server closed');
    await prisma.$disconnect();
    process.exit(0);
  });
});

export default app;

