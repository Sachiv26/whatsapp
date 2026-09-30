/**
 * Outbound message endpoints. Mounted at /api/messages in src/index.ts.
 *  POST /api/messages/text
 *  POST /api/messages/template
 *  POST /api/messages/media
 *  POST /api/messages/read
 */
import { Router, Request, Response, NextFunction } from 'express';
import { whatsappService, WhatsAppApiError } from '../services/whatsapp';
import type { SendMediaBody, SendTemplateBody, SendTextBody } from '../types/whatsapp';

export const messagesRouter = Router();

/** Wraps an async handler so rejected promises reach the Express error middleware. */
const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

/** Minimal phone-number sanity check: digits only, optional leading +. */
function isValidPhoneNumber(value: string): boolean {
  return /^\+?[0-9]{7,15}$/.test(value.trim());
}

function sendError(res: Response, status: number, message: string, details?: unknown): void {
  res.status(status).json({ success: false, error: message, details });
}

/** POST /api/messages/text — body: { to, text, previewUrl? } */
messagesRouter.post(
  '/text',
  asyncHandler(async (req, res) => {
    const { to, text, previewUrl = false } = req.body as SendTextBody;

    if (!to || !text) {
      sendError(res, 400, 'Both "to" and "text" are required.');
      return;
    }
    if (!isValidPhoneNumber(to)) {
      sendError(res, 400, 'Invalid "to": use international format without "+", e.g. 27831234567.');
      return;
    }

    try {
      const data = await whatsappService.sendTextMessage(to.trim(), text, Boolean(previewUrl));
      res.json({ success: true, data });
    } catch (error) {
      const status = error instanceof WhatsAppApiError ? error.status || 500 : 500;
      sendError(res, status, (error as Error).message);
    }
  })
);

/** POST /api/messages/template — body: { to, templateName, languageCode, components? } */
messagesRouter.post(
  '/template',
  asyncHandler(async (req, res) => {
    const { to, templateName, languageCode, components } = req.body as SendTemplateBody;

    if (!to || !templateName || !languageCode) {
      sendError(res, 400, 'Fields "to", "templateName" and "languageCode" are required.');
      return;
    }
    if (!isValidPhoneNumber(to)) {
      sendError(res, 400, 'Invalid "to": use international format without "+".');
      return;
    }

    try {
      const data = await whatsappService.sendTemplateMessage(
        to.trim(),
        templateName,
        languageCode,
        components
      );
      res.json({ success: true, data });
    } catch (error) {
      const status = error instanceof WhatsAppApiError ? error.status || 500 : 500;
      sendError(res, status, (error as Error).message);
    }
  })
);

/** POST /api/messages/media — body: { to, type, link|mediaId, caption? } */
messagesRouter.post(
  '/media',
  asyncHandler(async (req, res) => {
    const { to, type, link, mediaId, caption } = req.body as SendMediaBody;

    if (!to || !type) {
      sendError(res, 400, 'Fields "to" and "type" are required.');
      return;
    }
    if (!link && !mediaId) {
      sendError(res, 400, 'Provide either "link" (public HTTPS URL) or "mediaId".');
      return;
    }
    if (!isValidPhoneNumber(to)) {
      sendError(res, 400, 'Invalid "to": use international format without "+".');
      return;
    }

    try {
      const data = await whatsappService.sendMediaMessage(to.trim(), type, link, mediaId, caption);
      res.json({ success: true, data });
    } catch (error) {
      const status = error instanceof WhatsAppApiError ? error.status || 500 : 500;
      sendError(res, status, (error as Error).message);
    }
  })
);

/** POST /api/messages/read — body: { messageId } */
messagesRouter.post(
  '/read',
  asyncHandler(async (req, res) => {
    const { messageId } = (req.body ?? {}) as { messageId?: string };

    if (!messageId) {
      sendError(res, 400, 'Field "messageId" is required.');
      return;
    }

    try {
      await whatsappService.markMessageAsRead(messageId);
      res.json({ success: true, data: { messageId, status: 'read' } });
    } catch (error) {
      const status = error instanceof WhatsAppApiError ? error.status || 500 : 500;
      sendError(res, status, (error as Error).message);
    }
  })
);