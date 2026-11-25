# Deployment Guide

1. Set environment variables (`GEMINI_API_KEY`, `APP_URL`, `ADMIN_PASSCODE`, `PAYMENT_PROVIDER_MODE`, `PAYMENT_WEBHOOK_SECRET`, `SESSION_SECRET`).
2. Build client assets: `npm run build`.
3. Start the production server: `NODE_ENV=production npm start` (binds Express + API + static `dist/` on port `3000`).
4. Back up `data/meridian.db` and `uploads/` regularly.
