/**
 * TypeScript definitions for the Meta WhatsApp Business Cloud API payloads.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

/** An error object as returned by the Graph API. */
export interface GraphApiError {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
  error_data?: { messaging_product?: string; details?: string };
  error?: GraphApiError;
}

export interface ApiSuccessResponse {
  messaging_product: 'whatsapp';
  /** Unique id of the sent message. */
  messages: Array<{ id: string }>;
}

export interface ApiErrorResponse {
  error: GraphApiError;
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

/** Media payload inside an inbound message. */
export interface IncomingMedia {
  id?: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  filename?: string;
  /** Only present when Meta itself downloaded the media for you. */
  url?: string;
}

/** Reply buttons of an inbound interactive message. */
export interface IncomingInteractiveButtonReply {
  id: string;
  title: string;
}

export interface IncomingInteractiveListReply {
  id: string;
  title: string;
  description?: string;
}

export interface IncomingInteractive {
  type: 'button_reply' | 'list_reply';
  button_reply?: IncomingInteractiveButtonReply;
  list_reply?: IncomingInteractiveListReply;
}

export interface IncomingLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface IncomingContactAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  country_code?: string;
  type?: string;
}

export interface IncomingContact {
  addresses?: IncomingContactAddress[];
  birthday?: string;
  emails?: Array<{ email?: string; type?: string }>;
  name: { formatted_name: string; first_name?: string; last_name?: string };
  org?: { company?: string; department?: string; title?: string };
  phones?: Array<{ phone?: string; wa_id?: string; type?: string }>;
  urls?: Array<{ url?: string; type?: string }>;
}
/** An inbound (customer -> business) message. */
export interface IncomingMessage {
  /** Phone number of the sender, without "+". */
  from: string;
  /** WhatsApp message id (wamid.xxx). */
  id: string;
  /** Unix timestamp in seconds. */
  timestamp: string;
  type:
    | 'text'
    | 'image'
    | 'video'
    | 'audio'
    | 'document'
    | 'sticker'
    | 'location'
    | 'contacts'
    | 'interactive'
    | 'button'
    | 'order'
    | 'system'
    | 'unknown';
  text?: { body: string };
  image?: IncomingMedia;
  video?: IncomingMedia;
  audio?: IncomingMedia;
  document?: IncomingMedia;
  sticker?: IncomingMedia;
  location?: IncomingLocation;
  contacts?: IncomingContact[];
  interactive?: IncomingInteractive;
  button?: { payload: string; text: string };
  context?: { forwarded?: boolean; frequently_forwarded?: boolean; from?: string; id?: string };
  errors?: GraphApiError[];
}

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'deleted' | 'warning';

/** Delivery / read receipt update. */
export interface MessageStatusUpdate {
  id: string;
  status: MessageStatus;
  timestamp: string;
  recipient_id: string;
  conversation?: { id: string; origin?: { type: string }; expiration_timestamp?: string };
  pricing?: { billable?: boolean; pricing_model?: string; category?: string };
  errors?: GraphApiError[];
}

export interface WebhookContactProfile {
  wa_id: string;
  profile?: { name?: string };
}

/** `value` object of a webhook change. */
export interface WebhookValue {
  messaging_product?: 'whatsapp';
  metadata?: { display_phone_number: string; phone_number_id: string };
  contacts?: WebhookContactProfile[];
  messages?: IncomingMessage[];
  statuses?: MessageStatusUpdate[];
  errors?: GraphApiError[];
}

export interface WebhookChange {
  field?: 'messages';
  value: WebhookValue;
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

/** Full webhook POST body sent by Meta. */
export interface WebhookPayload {
  object?: 'whatsapp_business_account';
  entry: WebhookEntry[];
}

/* ------------------------------------------------------------------ */
/* Outgoing (API request) shapes                                       */
/* ------------------------------------------------------------------ */

/** Base fields shared by every outbound message. */
export interface SendRequestBase {
  messaging_product: 'whatsapp';
  recipient_type?: 'individual';
  to: string;
  context?: { message_id: string };
}

export interface SendTextRequest extends SendRequestBase {
  type: 'text';
  text: {
    body: string;
    /** Render a preview box for URLs found in the body. */
    preview_url?: boolean;
  };
}

export interface TemplateComponentParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video' | 'payload';
  text?: string;
  payload?: string;
  image?: { link?: string; id?: string };
  document?: { link?: string; id?: string; filename?: string };
  video?: { link?: string; id?: string };
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: TemplateComponentParameter[];
  sub_type?: 'quick_reply' | 'url';
  index?: number | string;
}

export interface SendTemplateRequest extends SendRequestBase {
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: TemplateComponent[];
  };
}

export interface SendMediaRequest extends SendRequestBase {
  type: 'image' | 'video' | 'document' | 'audio' | 'sticker';
  image?: { link?: string; id?: string; caption?: string };
  video?: { link?: string; id?: string; caption?: string };
  audio?: { link?: string; id?: string };
  document?: { link?: string; id?: string; caption?: string; filename?: string };
  sticker?: { link?: string; id?: string };
}

export interface InteractiveButton {
  /** Id echoed back when the user taps the button. */
  id: string;
  /** Button label, max 20 characters. */
  title: string;
}

export interface SendInteractiveButtonsRequest extends SendRequestBase {
  type: 'interactive';
  interactive: {
    type: 'button';
    header?: { type: 'text'; text: string };
    body: { text: string };
    footer?: { text: string };
    action: { buttons: InteractiveButton[] };
  };
}

/** Body accepted by POST /api/messages/text */
export interface SendTextBody {
  to: string;
  text: string;
  previewUrl?: boolean;
}

/** Body accepted by POST /api/messages/template */
export interface SendTemplateBody {
  to: string;
  templateName: string;
  languageCode: string;
  components?: TemplateComponent[];
}

/** Body accepted by POST /api/messages/media */
export interface SendMediaBody {
  to: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'sticker';
  /** Publicly reachable HTTPS URL. */
  link?: string;
  /** Media id from the Media API (alternative to link). */
  mediaId?: string;
  caption?: string;
}