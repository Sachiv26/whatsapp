/**
 * Webhook routes.
 *  GET  /webhook -> Meta verification handshake
 *  POST /webhook -> inbound messages and status updates
 */
import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import { handleWebhookPayload } from '../handlers/messageHandler';
import type { WebhookPayload } from '../types/whatsapp';

export const webhookRouter = Router();

/**
 * Meta verifies ownership by calling this URL with
 * ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 * We must echo hub.challenge back with HTTP 200, or 403 on mismatch.
 */
webhookRouter.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && verifyToken === env.webhookVerifyToken) {
    console.log('[webhook] Verification request succeeded.');
    res.status(200).send(challenge);
    return;
  }

  console.warn('[webhook] Verification failed: invalid mode or verify token.', {
    mode,
    receivedToken: verifyToken,
  });
  res.sendStatus(403);
});

/**
 * Meta POSTs inbound events here.
 * We MUST answer 200 within 5 seconds, so processing happens asynchronously.
 */
webhookRouter.post('/webhook', (req: Request, res: Response) => {
  // Raw payload for debugging (Meta also retries if we fail to respond).
  console.log('[webhook] Raw payload:', JSON.stringify(req.body));

  res.sendStatus(200); // acknowledge immediately

  const payload = req.body as WebhookPayload;

  // Fire and forget: never await, so Meta is not blocked by our processing.
  void handleWebhookPayload(payload);
});