# Security Architecture

- **Password Hashing**: `crypto.scryptSync` with per-user 16-byte random salts and `crypto.timingSafeEqual`.
- **Session Management**: HMAC-SHA256 signed session tokens supporting in-memory `Authorization: Bearer` headers and `HttpOnly; Secure; SameSite=None; Partitioned` cookies, paired with `Origin`/`X-Requested-With` verification on cookie-authenticated mutations.
- **Role-Based Access & Ownership**: Student routes enforce `attempt.user_id === req.authUser.id`; admin routes enforce `req.authUser.role === 'admin'`; audio recordings are served only to the owning candidate or administrators.
- **Answer Key Isolation**: `correct_answer_json` and `is_correct` are stripped from `/api/exams/:slug/start` and `/api/attempts/:id`.
- **Payment Integrity**: Paid access unlocks strictly via verified HMAC-SHA256 webhook confirmation, never from client success messages.
- **Path Confinement**: Audio uploads resolve under `uploads/` and check `resolvedPath.startsWith(uploadsDir + path.sep)`.
