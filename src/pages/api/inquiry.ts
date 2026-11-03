import type { APIRoute } from 'astro';
import { validate, imageKind } from '../../lib/validate.ts';
import { sendInquiry } from '../../lib/mail.ts';

export const prerender = false;

// shortcut: in-memory limiter is per serverless instance; use a shared store (e.g. Netlify Blobs) if abuse appears.
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000, MAX_HITS = 5;
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_HITS;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (Number(request.headers.get('content-length') ?? 0) > 6 * 1024 * 1024)
    return json(413, { ok: false, errors: { image: 'Фото має бути до 5 МБ.' } });
  if (limited(clientAddress ?? 'unknown'))
    return json(429, { ok: false, errors: { form: 'Забагато запитів. Спробуйте трохи пізніше.' } });

  let form: FormData;
  try { form = await request.formData(); } catch { return json(400, { ok: false, errors: { form: 'Некоректний запит.' } }); }

  const str = (k: string) => (typeof form.get(k) === 'string' ? (form.get(k) as string) : '');
  const file = form.get('image');
  const image = file instanceof File && file.size > 0
    ? { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name }
    : null;

  const r = validate({ type: str('type'), name: str('name'), contact: str('contact'), description: str('description'), item: str('item'), website: str('website') }, image);
  if (!r.ok) {
    if (r.errors.form === 'spam') return json(200, { ok: true }); // silently drop bots
    return json(422, r);
  }
  try {
    await sendInquiry(r.data, image ? { filename: `reference.${imageKind(image.bytes)}`, bytes: image.bytes } : undefined);
  } catch (e) {
    console.error('inquiry send failed', e);
    return json(502, { ok: false, errors: { form: 'Не вдалося надіслати. Спробуйте ще раз або напишіть нам на пошту.' } });
  }
  return json(200, { ok: true });
};
