import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

export default defineConfig({
  // No edge functions are used; skip the Deno emulator in dev.
  adapter: netlify({ devFeatures: { edgeFunctions: false, images: true, environmentVariables: false } }),
});
