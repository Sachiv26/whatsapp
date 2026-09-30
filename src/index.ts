/**
 * Application entrypoint: builds the Express app, mounts routes, starts listening.
 */
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { webhookRouter } from './routes/webhook';
import { messagesRouter } from './routes/messages';

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

/** Request logger: method, path, status and duration in ms. */
app.use((req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    console.log(`[http] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });

  next();
});

/** Root route: shows the service is alive and lists the available endpoints. */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'whatsapp-api',
    status: 'ok',
    graphApiVersion: env.graphApiVersion,
    endpoints: {
      health: 'GET /health',
      webhook: 'GET|POST /webhook',
      sendText: 'POST /api/messages/text',
      sendTemplate: 'POST /api/messages/template',
      sendMedia: 'POST /api/messages/media',
      markAsRead: 'POST /api/messages/read',
    },
    timestamp: new Date().toISOString(),
  });
});

// Simple liveness probe.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Browsers/extensions request this push-service-worker probe; answer quietly so it
// does not pollute the logs. It is unrelated to the WhatsApp API.
app.get('/sw-push.js', (_req: Request, res: Response) => {
  res.status(204).end();
});

// Meta webhook: GET (verification) + POST (events). Router paths already include /webhook.
app.use(webhookRouter);

// REST API to send messages.
app.use('/api/messages', messagesRouter);

// 404 for unknown routes. Common browser/extension probes (favicon, sw.js, etc.) are
// logged at a lower volume so real issues stand out in the console.
const IGNORED_404_PATHS = new Set([
  '/favicon.ico',
  '/sw.js',
  '/sw-push.js',
  '/robots.txt',
  '/manifest.json',
]);

app.use((req: Request, res: Response) => {
  if (!IGNORED_404_PATHS.has(req.path)) {
    console.warn(`[http] Unhandled request: ${req.method} ${req.originalUrl}`);
  }
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Central error handler — logs the stack and returns a safe JSON error.
// Express identifies error handlers by the 4-argument signature, so `next` must stay.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  res.status(500).json({ success: false, error: 'Internal server error', details: err.message });
});

app.listen(env.port, () => {
  console.log('==================================================');
  console.log(` Server running at: http://localhost:${env.port}`);
  console.log(` Health check     : http://localhost:${env.port}/health`);
  console.log(` Graph API version: ${env.graphApiVersion}`);
  console.log(` Phone number id  : ${env.whatsappPhoneNumberId}`);
  console.log('==================================================');
  console.log(' Reminder: Meta cannot reach localhost. Run `ngrok http ' + env.port + '`');
  console.log(` and set the webhook URL to https://<your-subdomain>.ngrok.io/webhook`);
  console.log('==================================================');
});