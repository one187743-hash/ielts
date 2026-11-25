# API Documentation

## Public
- `GET /api/public/overview` — Published exams, plans, banners, FAQs, study resources.
- `GET /api/verify/:code` — Public QR verification lookup incrementing verification count.
- `POST /api/contact` — Submit support inquiry.

## Authentication & Profile
- `POST /api/auth/register`, `POST /api/auth/verify-email`, `POST /api/auth/login`, `POST /api/auth/logout`
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/me`
- `GET /api/student/profile`, `PUT /api/student/profile`, `DELETE /api/account`

## Student Portal & Examination Engine
- `GET /api/student/dashboard`, `POST /api/student/notifications/:id/read`, `GET /api/exams`
- `POST /api/exams/:slug/start`, `GET /api/attempts/:id`, `PUT /api/attempts/:id/answer`
- `POST /api/attempts/:id/recordings`, `GET /api/recordings/:id`, `POST /api/attempts/:id/submit`
- `GET /api/reports`, `GET /api/reports/:id`, `GET /api/reports/:id/pdf`

## Subscriptions & Payments
- `GET /api/plans`, `POST /api/payments/checkout`
- `POST /api/payments/webhook` (HMAC-SHA256 verified via `x-meridian-signature`)
- `POST /api/payments/sandbox-confirm/:providerRef` (sandbox preview mode only)

## Administrator Portal (`/api/admin/*`)
- `GET /api/admin/bootstrap-status`, `POST /api/admin/claim`, `POST /api/admin/login`
- `GET /api/admin/overview`, `GET/PATCH /api/admin/students`, `GET/POST/PATCH /api/admin/exams`
- `POST /api/admin/exams/:id/questions`, `GET /api/admin/submissions`, `PATCH /api/admin/results/:resultId/review`
- `GET /api/admin/payments`, `PATCH /api/admin/plans/:id`, `GET/POST/DELETE /api/admin/content`
