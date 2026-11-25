# Database Schema

Defined in `server/db.ts` with 22 relational tables:
- `users`, `student_profiles`, `admin_users`
- `subscription_plans`, `subscriptions`, `payment_records`
- `examinations`, `exam_sections`, `questions`, `question_options`
- `exam_attempts`, `student_answers`, `audio_recordings`
- `assessment_results`, `skill_scores`, `ai_feedback`
- `result_reports`, `result_verifications`
- `notifications`, `study_resources`, `support_requests`, `audit_logs`

All student-owned tables reference `users(id)` with `ON DELETE CASCADE`, and indexes exist on `exam_attempts(user_id)`, `exam_attempts(exam_id)`, `student_answers(attempt_id)`, `questions(section_id)`, `result_reports(verification_code)`, `subscriptions(user_id)`, and `notifications(user_id)`.
