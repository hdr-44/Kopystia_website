import { TYPES, type InquiryType } from './validate.ts';

export interface Inquiry { type: InquiryType; name: string; contact: string; description: string; item: string }
export interface Attachment { filename: string; bytes: Uint8Array }

export function formatEmail(q: Inquiry) {
  const subject = `[Kopytsia] ${TYPES[q.type]}${q.item ? ` — ${q.item.slice(0, 80)}` : ''}`;
  const text = [
    `Тип запиту: ${TYPES[q.type]}`,
    ...(q.item ? [`Вибір: ${q.item}`] : []),
    `Ім’я: ${q.name}`,
    `Контакт: ${q.contact}`,
    '',
    q.description || '(без опису)',
  ].join('\n');
  return { subject, text };
}

// Resolves only when the mail service accepted the message; throws otherwise.
export async function sendInquiry(q: Inquiry, attachment?: Attachment): Promise<void> {
  const mode = import.meta.env.MAIL_MODE ?? process.env.MAIL_MODE;
  const to = import.meta.env.INQUIRY_TO ?? process.env.INQUIRY_TO ?? 'artemh@gmail.com';
  const { subject, text } = formatEmail(q);
  if (mode === 'mock') {
    console.log(`[mail:mock] to=${to}\n${subject}\n${text}${attachment ? `\n[attachment ${attachment.filename}, ${attachment.bytes.length} B]` : ''}`);
    return;
  }
  // shortcut: no real provider yet (email feature not final); wire Resend/Postmark here before launch.
  throw new Error('Mail service not configured (set MAIL_MODE=mock for development)');
}
