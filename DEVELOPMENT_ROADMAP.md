# Development Roadmap & Implementation Record

## Completed
- **Phase 1 — Foundation, Branding & Public Website**: Meridian Assessment identity, geometric logo crest, 3-zone header, 12-section editorial homepage, dedicated IELTS/PTE/TOEFL/General English pages, Mock Library, Resources, Pricing, About, Contact, Legal, and QR Verification.
- **Phase 2 — Authentication, Student Profiles & Database**: 22-table SQLite schema, scrypt auth, registration with personal/academic fields, email verification flow, password recovery, profile updates, and account deletion.
- **Phase 3 — Student Dashboard & Exam Library**: Real DB-backed Recharts analytics, 4 individual skill cards, weakness diagnostics, notifications, and multi-axis catalog filters.
- **Phase 4 & 5 — IELTS, PTE & TOEFL Exam Engines**: Timed sittings, continuous server autosave, reload resumption, flag-for-review, Listening audio briefing player, Reading split-pane, Writing editor with word counter & Task 1 charts, Speaking microphone capture & transcript fallback.
- **Phase 6 & 7 — AI Assessment, PDF & QR Reports**: Server-side `@google/genai` rubric assessment with honest `pending_review`/`unavailable` fallback, `pdfkit` unofficial PDF export, `qrcode` generation, and `/verify/:code`.
- **Phase 8 & 9 — Admin Portal & Subscriptions**: First-run admin claim gate, student management, exam/question builder, submission moderation with audit logs, plan configuration, and HMAC-verified payment webhooks.

## Pending External Configuration
- Configure `GEMINI_API_KEY` for live AI evaluation (falls back to manual examiner queue when unset).
- Configure `PAYMENT_PROVIDER_MODE="live"` and `PAYMENT_WEBHOOK_SECRET` for live gateway billing.
- Configure `SMTP_HOST` for external email delivery.
