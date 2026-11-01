# Kopystia Website

## Clickable prototype
- `design/`: page sources exported from the design canvas (https://claude.ai/artifact/FEGKYVa8FC8sJff3U3E8q4).
- `python3 tools/export_prototype.py` regenerates `prototype/` (static HTML + Alpine.js from a CDN) and fails if any link is broken.
- Preview locally: `cd prototype && python3 -m http.server`, then open http://localhost:8000.
