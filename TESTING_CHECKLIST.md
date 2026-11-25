# Testing Checklist

- [x] Pure scoring & grading unit tests (`npm run test` -> `src/lib/scoring.test.ts`).
- [x] TypeScript compilation (`npm run lint` -> `tsc --noEmit`).
- [x] Production bundle build (`npm run build`).
- [x] Live browser end-to-end verification across Public website, Candidate registration, Student Dashboard, Exam Engine (autosave, reload persistence, partial objective scoring), QR Report verification, Admin Portal (claim, moderation, audit log), and Mobile responsive layout (`390x844`).
- [ ] Live Gemini AI essay & speaking evaluation (requires configuring `GEMINI_API_KEY`; defaults safely to explicit pending/unavailable states when unset).
- [ ] Live external SMTP email delivery (requires configuring `SMTP_HOST`).
- [ ] Live payment gateway webhook (requires switching `PAYMENT_PROVIDER_MODE=live` and setting `PAYMENT_WEBHOOK_SECRET`).
