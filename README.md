# Kopytsia website

Ukrainian-language site for Kopytsia handmade custom hats. Its job is to start a conversation: every action ends in an inquiry email to the owner.

## Stack
- **Astro** (static pages + one server route) with the **Netlify** adapter.
- **three.js** for the 3D configurator and try-on; **MediaPipe Face Landmarker** for face tracking (runs in the browser; camera video never leaves the device). Both load only on their pages.
- Plain CSS, no UI framework. Tests use Node's built-in runner.

## Setup
```sh
npm install
cp .env.example .env   # MAIL_MODE=mock logs inquiries instead of emailing
npm run dev            # http://localhost:4321
npm test
npm run build
```
Netlify: build command `npm run build`, publish dir `dist`. Set `MAIL_MODE` and `INQUIRY_TO` in Netlify environment variables. A real email provider is **not wired yet**: see `src/lib/mail.ts`.

## Where things live
| What | Where |
| --- | --- |
| Editable content (products, FAQs, certificates, contacts, reviews, gallery, menu) | `src/content/*.json` |
| Blog articles | `src/pages/blog/*.md` |
| Configurator options | `src/content/configurator.json` |
| Try-on hat forms (GLB, size, position) | `src/content/tryon.json` + `public/models/` |
| Photos / logo | `public/images/`, `public/logo.png` |
| Inquiry endpoint, validation, email | `src/pages/api/inquiry.ts`, `src/lib/validate.ts`, `src/lib/mail.ts` |

Anything marked `PLACEHOLDER` / `ЗРАЗОК` must be replaced with confirmed content before launch.

## Credits
Sample try-on model: “Hat.” by Sergey Korotkikh, CC BY 4.0 — https://sketchfab.com/3d-models/hat-d9f0673d4f0445859b70892e416e293c
