/**
 * Loads environment variables and exposes a strictly typed, validated `env` object.
 * Importing this module anywhere in the app will fail fast if a required
 * variable is missing.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Copy .env.example to .env and fill in your Meta WhatsApp Cloud API credentials.`
    );
  }

  return value;
}

function numeric(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got "${raw}".`);
  }
  return parsed;
}

export const env = {
  /** Meta access token — NEVER hardcode this, always read from env. */
  whatsappAccessToken: required('WHATSAPP_ACCESS_TOKEN'),
  /** ID of the phone number the message is sent FROM. */
  whatsappPhoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
  /** WhatsApp Business Account ID (WABA). */
  whatsappBusinessAccountId: required('WHATSAPP_BUSINESS_ACCOUNT_ID'),
  /** Token you define yourself; Meta sends it back during webhook verification. */
  webhookVerifyToken: required('WEBHOOK_VERIFY_TOKEN'),
  /** Local HTTP server port. */
  port: numeric('PORT', 3000),
  /** Graph API version to target, e.g. "v21.0". */
  graphApiVersion: required('GRAPH_API_VERSION', 'v21.0'),
} as const;

export type Env = typeof env;