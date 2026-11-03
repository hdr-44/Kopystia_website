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
| Loading animation (regenerate: `python3 loader/generate.py`, needs Pillow) | `loader/` → `public/loader/` |
| Photos / logo | `public/images/`, `public/logo.png` |
| Inquiry endpoint, validation, email | `src/pages/api/inquiry.ts`, `src/lib/validate.ts`, `src/lib/mail.ts` |

Anything marked `PLACEHOLDER` / `ЗРАЗОК` must be replaced with confirmed content before launch.

## Scanned hats (3D files)
Configurator shapes come from the numbers in `configurator.json` (`height`, `topRadius`, `pinch`, `pinchDepth`, `pinchAngle`, `dentStretch`, brim `width`, `snap`). Scans of real hats should follow these rules:
- Scan with Polycam, Scaniverse or Apple Object Capture. Clean up in Blender and export **GLB**.
- Units in **centimetres**, origin at the centre of the head opening, the front facing **+Z**, Y up.
- About **50k triangles or fewer**, textures **2048 px or smaller**.
- Whole scanned hats → try-on (`public/models/`, `tryon.json`).
- A flat felt swatch scan (diffuse + normal map, tileable) → replaces the generated fibre texture `feltNormalMap` in `src/scripts/configurator.ts`.
- Configurator parts (crown / brim separately) need cutting in Blender at the band line. Loading them needs a small code change (an optional `model` field per option).

## Credits
Sample try-on model: “Hat.” by Sergey Korotkikh, CC BY 4.0 — https://sketchfab.com/3d-models/hat-d9f0673d4f0445859b70892e416e293c
