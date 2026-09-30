/**
 * CLI helper: sends one text message straight from the terminal.
 * Usage: npm run test:send -- 27831234567 "Hello from CLI"
 */
import { whatsappService } from '../services/whatsapp';
import { env } from '../config/env';

async function main(): Promise<void> {
  const [, , to, message] = process.argv;

  if (!to || !message) {
    console.error('Usage: npm run test:send -- <to> "<message>"');
    console.error('Example: npm run test:send -- 27831234567 "Hello from CLI"');
    process.exit(1);
  }

  console.log(`[test:send] From phone number id : ${env.whatsappPhoneNumberId}`);
  console.log(`[test:send] To                   : ${to}`);
  console.log(`[test:send] Message              : ${message}`);

  try {
    const response = await whatsappService.sendTextMessage(to, message);
    console.log('[test:send] Success. API response:');
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('[test:send] Failed to send message:', (error as Error).message);
    process.exit(1);
  }
}

void main();