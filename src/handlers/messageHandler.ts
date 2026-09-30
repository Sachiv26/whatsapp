/**
 * Business logic for inbound webhook payloads.
 * Called asynchronously from the webhook route AFTER a 200 has been sent to Meta.
 */
import { whatsappService } from '../services/whatsapp';
import type { IncomingMessage, MessageStatusUpdate, WebhookPayload } from '../types/whatsapp';

/** Processes one inbound message: logs it, marks it read, runs your business logic here. */
export async function handleIncomingMessage(message: IncomingMessage, profileName?: string): Promise<void> {
  const sender = profileName ? `${message.from} (${profileName})` : message.from;

  try {
    console.log('--------------------------------------------------');
    console.log(`[webhook] Inbound message from ${sender}`);
    console.log(`[webhook]   id       : ${message.id}`);
    console.log(`[webhook]   type     : ${message.type}`);
    console.log(`[webhook]   timestamp: ${message.timestamp}`);

    if (message.type === 'text' && message.text?.body) {
      console.log(`[webhook]   text     : ${message.text.body}`);
    }

    switch (message.type) {
      case 'image':
        console.log(`[webhook]   image id : ${message.image?.id ?? 'n/a'}`);
        break;
      case 'video':
        console.log(`[webhook]   video id : ${message.video?.id ?? 'n/a'}`);
        break;
      case 'audio':
        console.log(`[webhook]   audio id : ${message.audio?.id ?? 'n/a'}`);
        break;
      case 'document':
        console.log(
          `[webhook]   document : ${message.document?.filename ?? 'n/a'} (${message.document?.mime_type ?? 'unknown type'})`
        );
        break;
      case 'location':
        console.log(
          `[webhook]   location : ${message.location?.latitude}, ${message.location?.longitude} ${
            message.location?.name ?? ''
          }`
        );
        break;
      case 'interactive':
        console.log('[webhook]   button reply :', JSON.stringify(message.interactive ?? {}));
        break;
      default:
        console.log(`[webhook]   (no extra detail for type "${message.type}")`);
    }

    // Show the customer blue ticks as soon as we have their message.
    await whatsappService.markMessageAsRead(message.id);

    /* ------------------------------------------------------------------
     * TODO: your business logic goes here (save to DB, enqueue a job, ...).
     *
     * Example echo reply (enabled during development only):
     *
     * if (message.type === 'text' && message.text?.body) {
     *   await whatsappService.sendTextMessage(message.from, `Echo: ${message.text.body}`);
     * }
     *
     * Keep it fast: Meta retries webhooks that take longer than ~20s.
     * ------------------------------------------------------------------ */
  } catch (error) {
    console.error('[webhook] Error while handling inbound message:', (error as Error).message);
  }
}

/** Logs a delivery/read receipt update. */
export async function handleStatusUpdate(status: MessageStatusUpdate): Promise<void> {
  try {
    console.log('--------------------------------------------------');
    console.log(`[webhook] Status update for message ${status.id}`);
    console.log(`[webhook]   status   : ${status.status}`);
    console.log(`[webhook]   recipient: ${status.recipient_id}`);
    console.log(`[webhook]   timestamp: ${status.timestamp}`);

    if (status.errors && status.errors.length > 0) {
      console.error('[webhook]   errors   :', JSON.stringify(status.errors, null, 2));
    }
  } catch (error) {
    console.error('[webhook] Error while handling status update:', (error as Error).message);
  }
}

/**
 * Walks entry[] -> changes[] -> value[] and dispatches messages / statuses.
 * Never throws: webhook processing failures must not crash the server.
 */
export async function handleWebhookPayload(payload: WebhookPayload): Promise<void> {
  try {
    if (!payload || !Array.isArray(payload.entry) || payload.entry.length === 0) {
      console.warn('[webhook] Received payload with no entries:', JSON.stringify(payload));
      return;
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        console.log(
          `[webhook] Entry ${entry.id} | field=${change.field ?? 'n/a'} | phone=${
            value.metadata?.phone_number_id ?? 'n/a'
          }`
        );

        // Resolve the customer display name when Meta includes a contacts[] object.
        const nameFor = (waId: string): string | undefined =>
          value.contacts?.find((contact) => contact.wa_id === waId)?.profile?.name;

        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            await handleIncomingMessage(message, nameFor(message.from));
          }
        }

        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            await handleStatusUpdate(status);
          }
        }

        if (value.errors && value.errors.length > 0) {
          console.error('[webhook] Payload-level errors:', JSON.stringify(value.errors, null, 2));
        }
      }
    }
  } catch (error) {
    console.error('[webhook] Fatal error while processing webhook payload:', (error as Error).message);
  }
}