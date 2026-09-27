# VetSet showcase tools

Builds the marketing assets for the showcase page in `../site` from a sanitized copy of the app.

1. `npm install` (uses your installed Google Chrome through playwright-core; ffmpeg ships with `@ffmpeg-installer`).
2. `npm run app` — builds the app with `VITE_SHOWCASE=1`: invented towns and streets, (555) numbers, unlabeled Esri basemap.
3. `npm run shots` then `npm run video` — drives the demo at 390×844 @2× from a fake domain (`https://app.vetset.demo`) with the
   clock frozen at Tue Oct 6 2026 10:40; OSRM and map tiles are replayed from `cache/net`, every other request is blocked.
4. `npm run assets` — curates screenshots and writes the site's images, poster, favicons and link-preview image.
5. `npm run verify` — OCRs every screenshot and 2 frames/second of the video for real place names, area codes and old names.
