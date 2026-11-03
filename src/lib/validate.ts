// Server-side validation of inquiry submissions. Pure function so it can be tested with node --test.
export const TYPES = {
  custom: 'Кастомний капелюх',
  configurator: 'Конструктор капелюха',
  product: 'Модель з лінійки',
  'hutsul-hat': 'Баршівка (капелюх)',
  book: 'Книга про Баршівку',
  certificate: 'Подарунковий сертифікат',
  feedback: 'Відгук',
} as const;
export type InquiryType = keyof typeof TYPES;

const DESCRIPTION_REQUIRED: InquiryType[] = ['custom', 'feedback'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface Fields { type: string; name: string; contact: string; description: string; item: string; website: string }
export interface Image { bytes: Uint8Array; name: string }
export type Result =
  | { ok: true; data: { type: InquiryType; name: string; contact: string; description: string; item: string } }
  | { ok: false; errors: Record<string, string> };

const clean = (s: string | undefined) => (s ?? '').replace(/\r\n/g, '\n').trim();

// Check real file signature, not the client-supplied MIME type.
export function imageKind(b: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'webp';
  return null;
}

export function validate(f: Partial<Fields>, image?: Image | null): Result {
  const errors: Record<string, string> = {};
  const type = clean(f.type);
  const name = clean(f.name);
  const contact = clean(f.contact);
  const description = clean(f.description);
  const item = clean(f.item);

  if (clean(f.website)) errors.form = 'spam';
  if (!(type in TYPES)) errors.type = 'Невідомий тип запиту.';
  if (!name || name.length > 100) errors.name = 'Вкажіть ім’я (до 100 символів).';
  if (contact.length < 3 || contact.length > 200) errors.contact = 'Вкажіть, як з вами зв’язатися.';
  if (description.length > 3000) errors.description = 'Опис занадто довгий (до 3000 символів).';
  if (!description && DESCRIPTION_REQUIRED.includes(type as InquiryType)) errors.description = 'Коротко опишіть ваш запит.';
  if (item.length > 1000) errors.item = 'Некоректний вибір.';
  if (image) {
    if (image.bytes.length > MAX_IMAGE_BYTES) errors.image = 'Фото має бути до 5 МБ.';
    else if (!imageKind(image.bytes)) errors.image = 'Підтримуються JPG, PNG або WebP.';
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, data: { type: type as InquiryType, name, contact, description, item } };
}
