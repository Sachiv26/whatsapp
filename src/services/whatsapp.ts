/**
 * Typed wrapper around the Meta WhatsApp Business Cloud API.
 * Credentials come from `src/config/env.ts` — nothing is hardcoded.
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import { env } from '../config/env';
import type {
  ApiErrorResponse,
  ApiResponse,
  InteractiveButton,
  SendInteractiveButtonsRequest,
  SendMediaRequest,
  SendTemplateRequest,
  SendTextRequest,
  TemplateComponent,
} from '../types/whatsapp';

/** Thrown when Meta rejects a request. Carries the parsed Graph API error body. */
export class WhatsAppApiError extends Error {
  public readonly status: number;
  public readonly errorBody: ApiResponse | undefined;
  public readonly requestId: string | undefined;

  constructor(message: string, status: number, errorBody?: ApiResponse, requestId?: string) {
    super(message);
    this.name = 'WhatsAppApiError';
    this.status = status;
    this.errorBody = errorBody;
    this.requestId = requestId;
  }
}

export class WhatsAppClient {
  /** Central axios instance: base URL + auth header + logging interceptors. */
  private readonly http: AxiosInstance;

  /** e.g. https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID> */
  private readonly baseUrl: string;

  constructor() {
    // Meta's Graph API scopes every message call to the sending phone number.
    this.baseUrl = `https://graph.facebook.com/${env.graphApiVersion}/${env.whatsappPhoneNumberId}`;

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      headers: {
        // Bearer token auth for all Cloud API calls.
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    this.attachLoggingInterceptors();
  }

  /** Request/response interceptor; failures log Meta's full error body. */
  private attachLoggingInterceptors(): void {
    this.http.interceptors.request.use(
      (config) => {
        console.log(`[whatsapp] -> ${String(config.method).toUpperCase()} ${config.baseURL ?? ''}${config.url ?? ''}`);
        return config;
      },
      (error: AxiosError) => {
        console.error('[whatsapp] request interceptor error:', error.message);
        return Promise.reject(error);
      }
    );

    this.http.interceptors.response.use(
      (response) => {
        console.log(`[whatsapp] <- ${response.status} ${response.config.baseURL ?? ''}${response.config.url ?? ''}`);
        return response;
      },
      (error: AxiosError<ApiResponse>) => {
        const status = error.response?.status ?? 0;
        const body = error.response?.data;
        // Graph API errors come back on HTTP 4xx/5xx with an `error` object.
        const graphError = (body as ApiErrorResponse | undefined)?.error;

        console.error(`[whatsapp] <- ERROR ${status} ${error.config?.url ?? ''}`);
        if (graphError) {
          console.error('[whatsapp] Meta error message :', graphError.message);
          console.error('[whatsapp] Meta error type    :', graphError.type ?? 'n/a');
          console.error('[whatsapp] Meta error code    :', graphError.code ?? 'n/a');
          console.error('[whatsapp] Meta error subcode :', graphError.error_subcode ?? 'n/a');
          console.error('[whatsapp] Meta fbtrace_id    :', graphError.fbtrace_id ?? 'n/a');
          if (graphError.error_data?.details) {
            console.error('[whatsapp] Meta error details :', graphError.error_data.details);
          }
        } else {
          console.error('[whatsapp] Raw error response :', JSON.stringify(body ?? error.message, null, 2));
        }

        return Promise.reject(
          new WhatsAppApiError(
            graphError?.message ?? error.message ?? 'Unknown WhatsApp API error',
            status,
            body,
            graphError?.fbtrace_id
          )
        );
      }
    );
  }

  /** POST /{phone-number-id}/messages — the single send endpoint. */
  private async send(payload: Record<string, unknown>): Promise<ApiResponse> {
    const response = await this.http.post<ApiResponse>('/messages', payload);
    return response.data;
  }
/** Sends a plain text message. `previewUrl` renders a link preview for URLs in the body. */
  public async sendTextMessage(to: string, text: string, previewUrl = false): Promise<ApiResponse> {
    const payload: SendTextRequest = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text, preview_url: previewUrl },
    };

    return this.send(payload as unknown as Record<string, unknown>);
  }

  /** Sends a pre-approved template (required outside the 24h customer service window). */
  public async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: TemplateComponent[]
  ): Promise<ApiResponse> {
    const payload: SendTemplateRequest = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && components.length > 0 ? { components } : {}),
      },
    };

    return this.send(payload as unknown as Record<string, unknown>);
  }

  /**
   * Sends media either by public HTTPS `link` (Meta fetches it on demand)
   * or by `mediaId` previously obtained from the Media API.
   */
  public async sendMediaMessage(
    to: string,
    type: 'image' | 'video' | 'document' | 'audio' | 'sticker',
    link?: string,
    mediaId?: string,
    caption?: string
  ): Promise<ApiResponse> {
    if (!link && !mediaId) {
      throw new Error('sendMediaMessage requires either a link or a mediaId.');
    }

    const media: { link?: string; id?: string; caption?: string } = {
      ...(link ? { link } : { id: mediaId as string }),
      ...(caption ? { caption } : {}),
    };

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type,
      [type]: media,
    } as unknown as SendMediaRequest;

    return this.send(payload as unknown as Record<string, unknown>);
  }

  /** Sends up to 3 quick-reply buttons (each title max 20 characters). */
  public async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: InteractiveButton[],
    headerText?: string,
    footerText?: string
  ): Promise<ApiResponse> {
    if (buttons.length === 0) {
      throw new Error('sendInteractiveButtons requires at least one button.');
    }
    if (buttons.length > 3) {
      throw new Error('WhatsApp supports a maximum of 3 quick-reply buttons.');
    }

    const payload: SendInteractiveButtonsRequest = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(headerText ? { header: { type: 'text' as const, text: headerText } } : {}),
        body: { text: bodyText },
        ...(footerText ? { footer: { text: footerText } } : {}),
        action: { buttons },
      },
    };

    return this.send(payload as unknown as Record<string, unknown>);
  }

  /**
   * Marks an inbound message as read (blue ticks), using a status message object.
   * Failures are swallowed: a failed read receipt must never break webhook processing.
   */
  public async markMessageAsRead(messageId: string): Promise<void> {
    try {
      await this.http.post('/messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch (error) {
      console.warn('[whatsapp] Failed to mark message as read:', (error as Error).message);
    }
  }
}

/** Shared singleton used by routes, webhook handler and the CLI script. */
export const whatsappService = new WhatsAppClient();