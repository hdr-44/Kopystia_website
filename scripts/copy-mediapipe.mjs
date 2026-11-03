// Serve MediaPipe's wasm from our own origin so try-on works without third-party CDNs and always matches the installed version.
import { cpSync } from 'node:fs';
cpSync('node_modules/@mediapipe/tasks-vision/wasm', 'public/mediapipe', { recursive: true });
