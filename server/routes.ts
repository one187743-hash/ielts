import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Router } from 'express';
import { z } from 'zod';
import { db, getUploadsDir } from './db';
import {
  type AuthenticatedRequest,
  clearSessionCookie,
  createRateLimiter,
  createSessionToken,
  hashPassword,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from './auth';
import { assessResponseWithGemini, transcribeAudioWithGemini } from './ai';
import { generateQrDataUrl, generateReportPdfBuffer } from './reports';
import {
  computeOverallScore,
  countWords,
  gradeObjectiveAnswer,
  isSubjectiveQuestionType,
  rawRatioToIeltsBand,
  rawRatioToPteScore,
  rawRatioToToeflSectionScore,
  roundIeltsBand,
} from '../src/lib/scoring';
import type {
  AccessTier,
  ExamFamily,
  QuestionType,
  ResultReportDetail,
  SkillName,
  UserRole,
} from '../src/lib/types';

const TIER_RANK: Record<AccessTier, number> = {
  FREE: 0,
  BASIC: 1,
  PREMIUM: 2,
  INSTITUTIONAL: 3,
};

function logAudit(
  actorUserId: number | null,
  actorRole: string,
  action: string,
  targetType: string,
  targetId: string | number,
  reason?: string,
  metadata: Record<string, unknown> = {}
): void {
  db.prepare(
    `INSERT INTO audit_logs (actor_user_id, actor_role, action, target_type, target_id, reason, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(actorUserId, actorRole, action, targetType, String(targetId), reason ?? null, JSON.stringify(metadata));
}

function getUserActivePlan(userId: number) {
  const row = db
    .prepare(
      `SELECT s.id as subscription_id, s.status as sub_status, s.expires_at, s.attempts_used,
              p.id as plan_id, p.code, p.name, p.max_monthly_attempts, p.ai_assessment_enabled, p.pdf_reports_enabled
       FROM subscriptions s
       JOIN subscription_plans p ON p.id = s.plan_id
       WHERE s.user_id = ? AND s.status = 'active'
       ORDER BY s.id DESC LIMIT 1`
    )
    .get(userId) as
    | {
        subscription_id: number;
        sub_status: string;
        expires_at: string | null;
        attempts_used: number;
        plan_id: number;
        code: AccessTier;
        name: string;
        max_monthly_attempts: number;
        ai_assessment_enabled: number;
        pdf_reports_enabled: number;
      }
    | undefined;

  if (row) return row;

  const freePlan = db
    .prepare("SELECT * FROM subscription_plans WHERE code = 'FREE'")
    .get() as {
    id: number;
    code: AccessTier;
    name: string;
    max_monthly_attempts: number;
    ai_assessment_enabled: number;
    pdf_reports_enabled: number;
  };
  return {
    subscription_id: 0,
    sub_status: 'active',
    expires_at: null,
    attempts_used: 0,
    plan_id: freePlan.id,
    code: freePlan.code,
    name: freePlan.name,
    max_monthly_attempts: freePlan.max_monthly_attempts,
    ai_assessment_enabled: freePlan.ai_assessment_enabled,
    pdf_reports_enabled: freePlan.pdf_reports_enabled,
  };
}

function buildReportDetail(reportId: number): ResultReportDetail | null {
  const row = db
    .prepare(
      `SELECT rr.id as report_id, rr.result_id, rr.attempt_id, rr.candidate_ref, rr.report_ref, rr.verification_code, rr.status as report_status, rr.generated_at,
              ar.overall_score, ar.overall_label, ar.cefr_level, ar.status as result_status, ar.ai_model_version, ar.review_notes,
              ea.attempt_number, ea.submitted_at, ea.started_at,
              ex.title as exam_title, ex.exam_family,
              sp.full_name as candidate_name
       FROM result_reports rr
       JOIN assessment_results ar ON ar.id = rr.result_id
       JOIN exam_attempts ea ON ea.id = rr.attempt_id
       JOIN examinations ex ON ex.id = ea.exam_id
       LEFT JOIN student_profiles sp ON sp.user_id = rr.user_id
       WHERE rr.id = ?`
    )
    .get(reportId) as
    | {
        report_id: number;
        result_id: number;
        attempt_id: number;
        candidate_ref: string;
        report_ref: string;
        verification_code: string;
        report_status: 'pending' | 'completed' | 'reviewed' | 'invalidated';
        generated_at: string;
        overall_score: number;
        overall_label: string;
        cefr_level: string;
        result_status: string;
        ai_model_version: string | null;
        review_notes: string | null;
        attempt_number: number;
        submitted_at: string | null;
        started_at: string;
        exam_title: string;
        exam_family: ExamFamily;
        candidate_name: string | null;
      }
    | undefined;

  if (!row) return null;

  const skillRows = db
    .prepare('SELECT skill, score, max_score, band_or_scale_label, criteria_json FROM skill_scores WHERE result_id = ?')
    .all(row.result_id) as Array<{
    skill: SkillName;
    score: number;
    max_score: number;
    band_or_scale_label: string;
    criteria_json: string;
  }>;

  const feedbackRows = db
    .prepare('SELECT * FROM ai_feedback WHERE result_id = ?')
    .all(row.result_id) as Array<{
    id: number;
    skill: SkillName;
    question_id: number | null;
    criteria_scores_json: string;
    grammar_issues_json: string;
    vocabulary_notes: string;
    coherence_notes: string;
    fluency_notes: string;
    pronunciation_notes: string;
    strengths_json: string;
    weaknesses_json: string;
    recommendations_json: string;
    raw_summary: string;
    status: 'completed' | 'unavailable' | 'pending_review';
  }>;

  return {
    reportId: row.report_id,
    resultId: row.result_id,
    attemptId: row.attempt_id,
    candidateName: row.candidate_name || 'Candidate',
    candidateRef: row.candidate_ref,
    reportRef: row.report_ref,
    verificationCode: row.verification_code,
    examTitle: row.exam_title,
    examFamily: row.exam_family,
    examDate: row.submitted_at || row.started_at,
    attemptNumber: row.attempt_number,
    overallScore: row.overall_score,
    overallLabel: row.overall_label,
    cefrLevel: row.cefr_level,
    status: row.report_status,
    aiModelVersion: row.ai_model_version,
    reviewNotes: row.review_notes,
    skillScores: skillRows.map((s) => ({
      skill: s.skill,
      score: s.score,
      maxScore: s.max_score,
      label: s.band_or_scale_label,
      criteria: JSON.parse(s.criteria_json || '[]'),
    })),
    aiFeedback: feedbackRows.map((f) => ({
      id: f.id,
      skill: f.skill,
      questionId: f.question_id,
      status: f.status,
      criteriaScores: JSON.parse(f.criteria_scores_json || '[]'),
      grammarIssues: JSON.parse(f.grammar_issues_json || '[]'),
      vocabularyNotes: f.vocabulary_notes,
      coherenceNotes: f.coherence_notes,
      fluencyNotes: f.fluency_notes,
      pronunciationNotes: f.pronunciation_notes,
      strengths: JSON.parse(f.strengths_json || '[]'),
      weaknesses: JSON.parse(f.weaknesses_json || '[]'),
      recommendations: JSON.parse(f.recommendations_json || '[]'),
      rawSummary: f.raw_summary,
    })),
    disclaimer:
      'Independent, unofficial practice assessment issued by Meridian Assessment. Not affiliated with or endorsed by IELTS Partners, Pearson PTE, or ETS TOEFL.',
  };
}

function getWebhookSecret(): string {
  return process.env.PAYMENT_WEBHOOK_SECRET && process.env.PAYMENT_WEBHOOK_SECRET.length >= 8
    ? process.env.PAYMENT_WEBHOOK_SECRET
    : 'meridian-sandbox-webhook-key';
}

export function createApiRouter(): Router {
  const router = express.Router();
  const authRateLimiter = createRateLimiter(25, 15 * 60 * 1000);
  const contactRateLimiter = createRateLimiter(12, 15 * 60 * 1000);

  // ---------------- PUBLIC OVERVIEW & CONTENT ----------------
  router.get('/public/overview', (_req, res) => {
    const exams = db
      .prepare(
        `SELECT e.*, (SELECT COUNT(*) FROM questions q JOIN exam_sections s ON s.id = q.section_id WHERE s.exam_id = e.id) as question_count
         FROM examinations e WHERE e.published = 1 ORDER BY e.id ASC`
      )
      .all() as Array<{
      id: number;
      slug: string;
      title: string;
      exam_family: ExamFamily;
      category: string;
      primary_skill: string;
      difficulty: string;
      duration_minutes: number;
      access_tier: AccessTier;
      question_count: number;
    }>;

    const plans = db
      .prepare('SELECT * FROM subscription_plans WHERE active = 1 ORDER BY price_cents ASC')
      .all() as Array<Record<string, unknown>>;

    const resources = db
      .prepare('SELECT * FROM study_resources WHERE published = 1 ORDER BY id DESC')
      .all() as Array<Record<string, unknown>>;

    res.json({
      exams: exams.map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        examFamily: e.exam_family,
        category: e.category,
        primarySkill: e.primary_skill,
        difficulty: e.difficulty,
        durationMinutes: e.duration_minutes,
        accessTier: e.access_tier,
        published: true,
        questionCount: e.question_count,
        attemptedCount: 0,
      })),
      plans: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        priceCents: p.price_cents,
        currency: p.currency,
        durationDays: p.duration_days,
        maxMonthlyAttempts: p.max_monthly_attempts,
        aiAssessmentEnabled: Boolean(p.ai_assessment_enabled),
        pdfReportsEnabled: Boolean(p.pdf_reports_enabled),
        features: JSON.parse(String(p.features_json || '[]')),
        discountPercent: p.discount_percent,
        active: Boolean(p.active),
      })),
      resources: resources.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        examFamily: r.exam_family,
        skill: r.skill,
        resourceType: r.resource_type,
        summary: r.summary,
        content: r.content,
        published: Boolean(r.published),
        createdAt: r.created_at,
      })),
    });
  });

  router.post('/contact', contactRateLimiter, (req, res) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email(),
      subject: z.string().trim().min(3).max(160),
      message: z.string().trim().min(10).max(3000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please complete all required fields with a valid email and message.' });
      return;
    }
    const result = db
      .prepare('INSERT INTO support_requests (name, email, subject, message) VALUES (?, ?, ?, ?)')
      .run(parsed.data.name, parsed.data.email, parsed.data.subject, parsed.data.message);
    res.status(201).json({
      id: Number(result.lastInsertRowid),
      message: 'Your inquiry has been logged. Our academic support team will reply by email.',
    });
  });

  // Public QR verification endpoint
  router.get('/verify/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const row = db
      .prepare('SELECT id FROM result_reports WHERE UPPER(verification_code) = ?')
      .get(code) as { id: number } | undefined;
    if (!row) {
      res.status(404).json({ error: 'No assessment report found for that verification code.' });
      return;
    }

    db.prepare(
      `UPDATE result_verifications SET verified_count = verified_count + 1, last_verified_at = datetime('now')
       WHERE report_id = ?`
    ).run(row.id);

    const detail = buildReportDetail(row.id);
    if (!detail) {
      res.status(404).json({ error: 'Report details unavailable.' });
      return;
    }

    // Mask full candidate name slightly if public? Or show initials + full ref for authentic verification
    const parts = detail.candidateName.split(' ');
    const publicName =
      parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : detail.candidateName;

    const verRow = db
      .prepare('SELECT verified_count, last_verified_at FROM result_verifications WHERE report_id = ?')
      .get(row.id) as { verified_count: number; last_verified_at: string | null } | undefined;

    res.json({
      verified: detail.status !== 'invalidated',
      reportRef: detail.reportRef,
      verificationCode: detail.verificationCode,
      candidateRef: detail.candidateRef,
      candidateInitialsName: publicName,
      examTitle: detail.examTitle,
      examFamily: detail.examFamily,
      examDate: detail.examDate,
      overallLabel: detail.overallLabel,
      cefrLevel: detail.cefrLevel,
      status: detail.status,
      skillScores: detail.skillScores,
      verifiedCount: verRow?.verified_count ?? 1,
      lastVerifiedAt: verRow?.last_verified_at,
      disclaimer: detail.disclaimer,
    });
  });

  // ---------------- AUTHENTICATION & REGISTRATION ----------------
  router.post('/auth/register', authRateLimiter, (req, res) => {
    const schema = z.object({
      email: z.string().trim().email(),
      password: z.string().min(8).max(128),
      fullName: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(40).optional().nullable(),
      country: z.string().trim().min(2).max(80),
      city: z.string().trim().max(80).optional().nullable(),
      dateOfBirth: z.string().trim().max(20).optional().nullable(),
      educationLevel: z.string().trim().min(2).max(80),
      preferredExam: z.enum([
        'IELTS_ACADEMIC',
        'IELTS_GENERAL',
        'PTE_ACADEMIC',
        'TOEFL_IBT',
        'GENERAL_ENGLISH',
      ]),
      targetScore: z.string().trim().min(1).max(20),
      intendedExamDate: z.string().trim().max(20).optional().nullable(),
      objective: z.string().trim().min(2).max(160),
      privacyConsent: z.literal(true),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid registration details. Ensure password is 8+ characters and consent is accepted.' });
      return;
    }

    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(parsed.data.email) as { id: number } | undefined;
    if (existing) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const freePlan = db
      .prepare("SELECT id FROM subscription_plans WHERE code = 'FREE'")
      .get() as { id: number };

    const tx = db.transaction(() => {
      const userRes = db
        .prepare(
          `INSERT INTO users (email, password_hash, role, email_verified, verification_code, status)
           VALUES (?, ?, 'student', 0, ?, 'active')`
        )
        .run(parsed.data.email.toLowerCase(), hashPassword(parsed.data.password), verificationCode);
      const userId = Number(userRes.lastInsertRowid);

      db.prepare(
        `INSERT INTO student_profiles (user_id, full_name, phone, country, city, date_of_birth, education_level, preferred_exam, target_score, intended_exam_date, objective, privacy_consent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      ).run(
        userId,
        parsed.data.fullName,
        parsed.data.phone || null,
        parsed.data.country,
        parsed.data.city || null,
        parsed.data.dateOfBirth || null,
        parsed.data.educationLevel,
        parsed.data.preferredExam,
        parsed.data.targetScore,
        parsed.data.intendedExamDate || null,
        parsed.data.objective
      );

      db.prepare(
        `INSERT INTO subscriptions (user_id, plan_id, status, starts_at, expires_at, attempts_used)
         VALUES (?, ?, 'active', datetime('now'), datetime('now', '+365 days'), 0)`
      ).run(userId, freePlan.id);

      db.prepare(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES (?, 'Welcome to Meridian Assessment', 'Verify your email address and begin with your complimentary CEFR Diagnostic or IELTS Series 01 mock test.', 'account')`
      ).run(userId);

      return userId;
    });

    const userId = tx();
    const token = createSessionToken(userId, 'student');
    setSessionCookie(res, token);

    const smtpConfigured = Boolean(process.env.SMTP_HOST);
    res.status(201).json({
      token,
      user: {
        id: userId,
        email: parsed.data.email.toLowerCase(),
        role: 'student',
        emailVerified: false,
        status: 'active',
        fullName: parsed.data.fullName,
        planCode: 'FREE',
        planName: 'Foundation Free',
      },
      // When SMTP is not configured in preview, surface the verification code so the user can test verification flow
      verificationNotice: smtpConfigured
        ? 'A 6-digit verification code has been emailed to you.'
        : `Preview verification code (SMTP not configured): ${verificationCode}`,
    });
  });

  router.post('/auth/verify-email', requireAuth, (req: AuthenticatedRequest, res) => {
    const schema = z.object({ code: z.string().trim().min(4).max(12) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid verification code format.' });
      return;
    }

    const row = db
      .prepare('SELECT verification_code FROM users WHERE id = ?')
      .get(req.authUser!.id) as { verification_code: string | null } | undefined;

    if (!row || row.verification_code !== parsed.data.code) {
      res.status(400).json({ error: 'Verification code does not match.' });
      return;
    }

    db.prepare("UPDATE users SET email_verified = 1, verification_code = NULL, updated_at = datetime('now') WHERE id = ?").run(
      req.authUser!.id
    );
    res.json({ verified: true });
  });

  router.post('/auth/login', authRateLimiter, (req, res) => {
    const schema = z.object({
      email: z.string().trim().email(),
      password: z.string().min(1).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid email and password are required.' });
      return;
    }

    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(parsed.data.email.toLowerCase()) as
      | {
          id: number;
          email: string;
          password_hash: string;
          role: UserRole;
          email_verified: number;
          status: string;
        }
      | undefined;

    if (!user || user.status !== 'active' || !verifyPassword(parsed.data.password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const profile = db
      .prepare('SELECT full_name FROM student_profiles WHERE user_id = ?')
      .get(user.id) as { full_name: string } | undefined;
    const adminProfile = db
      .prepare('SELECT full_name FROM admin_users WHERE user_id = ?')
      .get(user.id) as { full_name: string } | undefined;
    const plan = getUserActivePlan(user.id);

    const token = createSessionToken(user.id, user.role);
    setSessionCookie(res, token);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: Boolean(user.email_verified),
        status: user.status,
        fullName: profile?.full_name || adminProfile?.full_name || user.email,
        planCode: plan.code,
        planName: plan.name,
      },
    });
  });

  router.post('/auth/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.post('/auth/forgot-password', authRateLimiter, (req, res) => {
    const schema = z.object({ email: z.string().trim().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    const user = db
      .prepare("SELECT id FROM users WHERE email = ? AND status = 'active'")
      .get(parsed.data.email.toLowerCase()) as { id: number } | undefined;

    if (!user) {
      // Uniform response to avoid account enumeration
      res.json({ message: 'If an account matches that email, password recovery instructions have been issued.' });
      return;
    }

    const resetToken = crypto.randomBytes(12).toString('hex');
    db.prepare(
      "UPDATE users SET reset_token = ?, reset_expires_at = datetime('now', '+1 hour') WHERE id = ?"
    ).run(resetToken, user.id);

    const smtpConfigured = Boolean(process.env.SMTP_HOST);
    res.json({
      message: smtpConfigured
        ? 'If an account matches that email, password recovery instructions have been emailed.'
        : `Preview recovery token (SMTP not configured): ${resetToken}`,
    });
  });

  router.post('/auth/reset-password', authRateLimiter, (req, res) => {
    const schema = z.object({
      email: z.string().trim().email(),
      token: z.string().trim().min(6),
      newPassword: z.string().min(8).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid reset details. Password must be at least 8 characters.' });
      return;
    }

    const user = db
      .prepare(
        "SELECT id FROM users WHERE email = ? AND reset_token = ? AND reset_expires_at > datetime('now')"
      )
      .get(parsed.data.email.toLowerCase(), parsed.data.token) as { id: number } | undefined;

    if (!user) {
      res.status(400).json({ error: 'Reset token is invalid or expired.' });
      return;
    }

    db.prepare(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL, updated_at = datetime('now') WHERE id = ?"
    ).run(hashPassword(parsed.data.newPassword), user.id);

    res.json({ ok: true, message: 'Password updated. You may now sign in.' });
  });

  router.get('/auth/me', (req: AuthenticatedRequest, res) => {
    if (!req.authUser) {
      res.json({ user: null });
      return;
    }
    const profile = db
      .prepare('SELECT full_name FROM student_profiles WHERE user_id = ?')
      .get(req.authUser.id) as { full_name: string } | undefined;
    const adminProfile = db
      .prepare('SELECT full_name FROM admin_users WHERE user_id = ?')
      .get(req.authUser.id) as { full_name: string } | undefined;
    const plan = getUserActivePlan(req.authUser.id);

    res.json({
      user: {
        id: req.authUser.id,
        email: req.authUser.email,
        role: req.authUser.role,
        emailVerified: req.authUser.emailVerified,
        status: req.authUser.status,
        fullName: profile?.full_name || adminProfile?.full_name || req.authUser.email,
        planCode: plan.code,
        planName: plan.name,
      },
    });
  });

  // ---------------- STUDENT PROFILE & ACCOUNT ----------------
  router.get('/student/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const profile = db
      .prepare('SELECT * FROM student_profiles WHERE user_id = ?')
      .get(req.authUser!.id) as Record<string, unknown> | undefined;
    const plan = getUserActivePlan(req.authUser!.id);

    res.json({
      userId: req.authUser!.id,
      email: req.authUser!.email,
      emailVerified: req.authUser!.emailVerified,
      fullName: profile?.full_name || '',
      phone: profile?.phone || null,
      country: profile?.country || 'United Kingdom',
      city: profile?.city || null,
      dateOfBirth: profile?.date_of_birth || null,
      educationLevel: profile?.education_level || 'Undergraduate',
      preferredExam: profile?.preferred_exam || 'IELTS_ACADEMIC',
      targetScore: profile?.target_score || '7.5',
      intendedExamDate: profile?.intended_exam_date || null,
      objective: profile?.objective || 'University Admission',
      privacyConsent: Boolean(profile?.privacy_consent ?? 1),
      planCode: plan.code,
      planName: plan.name,
      subscriptionStatus: plan.sub_status,
      expiresAt: plan.expires_at,
      attemptsUsed: plan.attempts_used,
      maxMonthlyAttempts: plan.max_monthly_attempts,
      aiAssessmentEnabled: Boolean(plan.ai_assessment_enabled),
      pdfReportsEnabled: Boolean(plan.pdf_reports_enabled),
    });
  });

  router.put('/student/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      fullName: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(40).optional().nullable(),
      country: z.string().trim().min(2).max(80),
      city: z.string().trim().max(80).optional().nullable(),
      educationLevel: z.string().trim().min(2).max(80),
      preferredExam: z.enum([
        'IELTS_ACADEMIC',
        'IELTS_GENERAL',
        'PTE_ACADEMIC',
        'TOEFL_IBT',
        'GENERAL_ENGLISH',
      ]),
      targetScore: z.string().trim().min(1).max(20),
      intendedExamDate: z.string().trim().max(20).optional().nullable(),
      objective: z.string().trim().min(2).max(160),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please provide valid profile information.' });
      return;
    }

    db.prepare(
      `UPDATE student_profiles
       SET full_name = ?, phone = ?, country = ?, city = ?, education_level = ?, preferred_exam = ?, target_score = ?, intended_exam_date = ?, objective = ?, updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(
      parsed.data.fullName,
      parsed.data.phone || null,
      parsed.data.country,
      parsed.data.city || null,
      parsed.data.educationLevel,
      parsed.data.preferredExam,
      parsed.data.targetScore,
      parsed.data.intendedExamDate || null,
      parsed.data.objective,
      req.authUser!.id
    );

    res.json({ ok: true });
  });

  router.delete('/account', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    logAudit(userId, req.authUser!.role, 'ACCOUNT_DELETED', 'user', userId, 'User requested account deletion');
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // ---------------- STUDENT DASHBOARD & EXAMS ----------------
  router.get('/student/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const profile = db
      .prepare('SELECT * FROM student_profiles WHERE user_id = ?')
      .get(userId) as Record<string, unknown> | undefined;
    const plan = getUserActivePlan(userId);

    const recentReports = db
      .prepare(
        `SELECT rr.id as report_id, rr.report_ref, rr.verification_code, rr.status, rr.generated_at,
                ar.id as result_id, ar.overall_score, ar.overall_label, ar.cefr_level,
                ex.title as exam_title, ex.exam_family, ea.attempt_number
         FROM result_reports rr
         JOIN assessment_results ar ON ar.id = rr.result_id
         JOIN exam_attempts ea ON ea.id = rr.attempt_id
         JOIN examinations ex ON ex.id = ea.exam_id
         WHERE rr.user_id = ?
         ORDER BY rr.generated_at DESC`
      )
      .all(userId) as Array<Record<string, unknown>>;

    const skillAveragesRaw = db
      .prepare(
        `SELECT ss.skill, AVG(ss.score) as avg_score, MAX(ss.max_score) as max_score, COUNT(*) as count
         FROM skill_scores ss
         JOIN assessment_results ar ON ar.id = ss.result_id
         JOIN exam_attempts ea ON ea.id = ar.attempt_id
         WHERE ea.user_id = ? AND ar.status != 'invalidated'
         GROUP BY ss.skill`
      )
      .all(userId) as Array<{ skill: SkillName; avg_score: number; max_score: number; count: number }>;

    const skillMap: Record<SkillName, { avgScore: number | null; maxScore: number; count: number }> = {
      Listening: { avgScore: null, maxScore: 9, count: 0 },
      Reading: { avgScore: null, maxScore: 9, count: 0 },
      Writing: { avgScore: null, maxScore: 9, count: 0 },
      Speaking: { avgScore: null, maxScore: 9, count: 0 },
    };
    for (const row of skillAveragesRaw) {
      skillMap[row.skill] = {
        avgScore: Math.round(row.avg_score * 10) / 10,
        maxScore: row.max_score,
        count: row.count,
      };
    }

    // Performance history for Recharts
    const history = recentReports
      .slice(0, 8)
      .reverse()
      .map((r) => {
        const sRows = db
          .prepare('SELECT skill, score FROM skill_scores WHERE result_id = ?')
          .all(r.result_id) as Array<{ skill: SkillName; score: number }>;
        const entry: Record<string, unknown> = {
          label: `#${r.attempt_number} ${String(r.exam_family).split('_')[0]}`,
          overall: r.overall_score,
          date: String(r.generated_at).slice(0, 10),
        };
        for (const s of sRows) {
          entry[s.skill] = s.score;
        }
        return entry;
      });

    // Real weakness & recommendations aggregated from ai_feedback
    const fbRows = db
      .prepare(
        `SELECT af.weaknesses_json, af.recommendations_json, af.skill
         FROM ai_feedback af
         JOIN assessment_results ar ON ar.id = af.result_id
         JOIN exam_attempts ea ON ea.id = ar.attempt_id
         WHERE ea.user_id = ? AND af.status = 'completed'
         ORDER BY af.id DESC LIMIT 6`
      )
      .all(userId) as Array<{ weaknesses_json: string; recommendations_json: string; skill: string }>;

    const weaknesses: string[] = [];
    const recommendations: string[] = [];
    for (const fb of fbRows) {
      const wList = JSON.parse(fb.weaknesses_json || '[]') as string[];
      const rList = JSON.parse(fb.recommendations_json || '[]') as string[];
      for (const w of wList) if (!weaknesses.includes(w)) weaknesses.push(w);
      for (const rec of rList) if (!recommendations.includes(rec)) recommendations.push(rec);
    }

    const totalAttempts = (
      db.prepare('SELECT COUNT(*) as c FROM exam_attempts WHERE user_id = ?').get(userId) as { c: number }
    ).c;

    const avgOverall =
      recentReports.length > 0
        ? Math.round(
            (recentReports.reduce((acc, r) => acc + Number(r.overall_score || 0), 0) / recentReports.length) * 10
          ) / 10
        : null;

    const notifications = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 10')
      .all(userId);

    const recommendedExams = db
      .prepare(
        `SELECT id, slug, title, exam_family, category, primary_skill, difficulty, duration_minutes, access_tier
         FROM examinations WHERE published = 1
         ORDER BY CASE WHEN exam_family = ? THEN 0 ELSE 1 END, id ASC LIMIT 3`
      )
      .all(String(profile?.preferred_exam || 'IELTS_ACADEMIC'));

    res.json({
      profile: {
        fullName: profile?.full_name || req.authUser!.email,
        preferredExam: profile?.preferred_exam || 'IELTS_ACADEMIC',
        targetScore: profile?.target_score || '7.5',
        intendedExamDate: profile?.intended_exam_date || null,
        objective: profile?.objective || 'Academic Preparation',
        country: profile?.country || '',
      },
      plan,
      stats: {
        totalAttempts,
        completedReports: recentReports.length,
        averageOverall: avgOverall,
        skillAverages: skillMap,
      },
      history,
      recentReports,
      weaknesses: weaknesses.slice(0, 5),
      recommendations: recommendations.slice(0, 5),
      recommendedExams,
      notifications,
    });
  });

  router.post('/student/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
      Number(req.params.id),
      req.authUser!.id
    );
    res.json({ ok: true });
  });

  router.get('/exams', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const rows = db
      .prepare(
        `SELECT e.*,
                (SELECT COUNT(*) FROM questions q JOIN exam_sections s ON s.id = q.section_id WHERE s.exam_id = e.id) as question_count,
                (SELECT COUNT(*) FROM exam_attempts a WHERE a.exam_id = e.id AND a.user_id = ?) as attempted_count,
                (SELECT a.status FROM exam_attempts a WHERE a.exam_id = e.id AND a.user_id = ? ORDER BY a.id DESC LIMIT 1) as last_attempt_status,
                (SELECT ar.overall_label FROM exam_attempts a JOIN assessment_results ar ON ar.attempt_id = a.id WHERE a.exam_id = e.id AND a.user_id = ? ORDER BY a.id DESC LIMIT 1) as last_score_label
         FROM examinations e
         WHERE e.published = 1
         ORDER BY e.id ASC`
      )
      .all(userId, userId, userId) as Array<Record<string, unknown>>;

    res.json({
      exams: rows.map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        examFamily: e.exam_family,
        category: e.category,
        primarySkill: e.primary_skill,
        difficulty: e.difficulty,
        durationMinutes: e.duration_minutes,
        accessTier: e.access_tier,
        published: Boolean(e.published),
        questionCount: e.question_count,
        attemptedCount: e.attempted_count,
        lastAttemptStatus: e.last_attempt_status,
        lastScoreLabel: e.last_score_label,
      })),
    });
  });

  // ---------------- EXAMINATION ENGINE ----------------
  function loadAttemptPayload(attemptId: number) {
    const attempt = db
      .prepare(
        `SELECT ea.*, ex.title as exam_title, ex.exam_family, ex.category
         FROM exam_attempts ea
         JOIN examinations ex ON ex.id = ea.exam_id
         WHERE ea.id = ?`
      )
      .get(attemptId) as
      | {
          id: number;
          exam_id: number;
          user_id: number;
          attempt_number: number;
          status: string;
          started_at: string;
          expires_at: string;
          submitted_at: string | null;
          current_section_idx: number;
          flagged_questions_json: string;
          exam_title: string;
          exam_family: ExamFamily;
          category: string;
        }
      | undefined;

    if (!attempt) return null;

    const sections = db
      .prepare('SELECT * FROM exam_sections WHERE exam_id = ? ORDER BY section_order ASC')
      .all(attempt.exam_id) as Array<Record<string, unknown>>;

    const mappedSections = sections.map((sec) => {
      const qRows = db
        .prepare('SELECT * FROM questions WHERE section_id = ? ORDER BY question_order ASC')
        .all(sec.id) as Array<Record<string, unknown>>;

      const questions = qRows.map((q) => {
        // NEVER include is_correct or correct_answer_json in student attempt delivery
        const optRows = db
          .prepare('SELECT option_key, option_text FROM question_options WHERE question_id = ? ORDER BY id ASC')
          .all(q.id) as Array<{ option_key: string; option_text: string }>;

        return {
          id: Number(q.id),
          sectionId: Number(q.section_id),
          questionOrder: Number(q.question_order),
          questionType: q.question_type as QuestionType,
          prompt: String(q.prompt),
          contextText: q.context_text ? String(q.context_text) : null,
          imageUrl: q.image_url ? String(q.image_url) : null,
          audioUrl: q.audio_url ? String(q.audio_url) : null,
          prepSeconds: Number(q.prep_seconds || 0),
          recordSeconds: Number(q.record_seconds || 0),
          maxMarks: Number(q.max_marks || 1),
          options: optRows.map((o) => ({ optionKey: o.option_key, optionText: o.option_text })),
        };
      });

      return {
        id: Number(sec.id),
        examId: Number(sec.exam_id),
        title: String(sec.title),
        skill: sec.skill as SkillName,
        sectionOrder: Number(sec.section_order),
        durationMinutes: Number(sec.duration_minutes),
        instructions: String(sec.instructions),
        passageTitle: sec.passage_title ? String(sec.passage_title) : null,
        passageText: sec.passage_text ? String(sec.passage_text) : null,
        audioScript: sec.audio_script ? String(sec.audio_script) : null,
        audioUrl: sec.audio_url ? String(sec.audio_url) : null,
        questions,
      };
    });

    const ansRows = db
      .prepare('SELECT * FROM student_answers WHERE attempt_id = ?')
      .all(attemptId) as Array<{
      question_id: number;
      answer_text: string;
      selected_option_key: string;
      audio_recording_id: number | null;
      word_count: number;
      is_flagged: number;
    }>;

    const savedAnswers: Record<
      number,
      {
        answerText: string;
        selectedOptionKey: string;
        audioRecordingId: number | null;
        wordCount: number;
        isFlagged: boolean;
      }
    > = {};

    for (const a of ansRows) {
      savedAnswers[a.question_id] = {
        answerText: a.answer_text,
        selectedOptionKey: a.selected_option_key,
        audioRecordingId: a.audio_recording_id,
        wordCount: a.word_count,
        isFlagged: Boolean(a.is_flagged),
      };
    }

    return {
      attempt: {
        id: attempt.id,
        examId: attempt.exam_id,
        examTitle: attempt.exam_title,
        examFamily: attempt.exam_family,
        category: attempt.category,
        attemptNumber: attempt.attempt_number,
        status: attempt.status,
        startedAt: attempt.started_at,
        expiresAt: attempt.expires_at,
        submittedAt: attempt.submitted_at,
        currentSectionIdx: attempt.current_section_idx,
        flaggedQuestions: JSON.parse(attempt.flagged_questions_json || '[]'),
      },
      sections: mappedSections,
      savedAnswers,
    };
  }

  router.post('/exams/:slug/start', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const exam = db
      .prepare('SELECT * FROM examinations WHERE slug = ? AND published = 1')
      .get(req.params.slug) as
      | { id: number; access_tier: AccessTier; duration_minutes: number }
      | undefined;

    if (!exam) {
      res.status(404).json({ error: 'Examination not found.' });
      return;
    }

    // Resume existing in-progress attempt if not expired
    const existing = db
      .prepare(
        "SELECT id, expires_at FROM exam_attempts WHERE exam_id = ? AND user_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1"
      )
      .get(exam.id, userId) as { id: number; expires_at: string } | undefined;

    if (existing && Date.parse(existing.expires_at) > Date.now()) {
      const payload = loadAttemptPayload(existing.id);
      res.json(payload);
      return;
    }

    // Enforce subscription tier & monthly limit
    const plan = getUserActivePlan(userId);
    if (TIER_RANK[plan.code] < TIER_RANK[exam.access_tier] && req.authUser!.role !== 'admin') {
      res.status(403).json({
        error: `This examination requires the ${exam.access_tier} plan. Upgrade your package in Profile & Subscriptions.`,
      });
      return;
    }

    if (plan.attempts_used >= plan.max_monthly_attempts && req.authUser!.role !== 'admin') {
      res.status(403).json({
        error: `Monthly attempt limit (${plan.max_monthly_attempts}) reached for your current plan.`,
      });
      return;
    }

    const prevCount = (
      db
        .prepare('SELECT COUNT(*) as c FROM exam_attempts WHERE exam_id = ? AND user_id = ?')
        .get(exam.id, userId) as { c: number }
    ).c;

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + exam.duration_minutes * 60 * 1000);

    const ins = db
      .prepare(
        `INSERT INTO exam_attempts (exam_id, user_id, attempt_number, status, started_at, expires_at)
         VALUES (?, ?, ?, 'in_progress', ?, ?)`
      )
      .run(exam.id, userId, prevCount + 1, startedAt.toISOString(), expiresAt.toISOString());

    if (plan.subscription_id) {
      db.prepare('UPDATE subscriptions SET attempts_used = attempts_used + 1 WHERE id = ?').run(
        plan.subscription_id
      );
    }

    const payload = loadAttemptPayload(Number(ins.lastInsertRowid));
    res.status(201).json(payload);
  });

  router.get('/attempts/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const attemptId = Number(req.params.id);
    const owner = db
      .prepare('SELECT user_id FROM exam_attempts WHERE id = ?')
      .get(attemptId) as { user_id: number } | undefined;

    if (!owner) {
      res.status(404).json({ error: 'Examination attempt not found.' });
      return;
    }
    if (owner.user_id !== req.authUser!.id && req.authUser!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    res.json(loadAttemptPayload(attemptId));
  });

  router.put('/attempts/:id/answer', requireAuth, (req: AuthenticatedRequest, res) => {
    const attemptId = Number(req.params.id);
    const attempt = db
      .prepare('SELECT id, user_id, status, expires_at FROM exam_attempts WHERE id = ?')
      .get(attemptId) as { id: number; user_id: number; status: string; expires_at: string } | undefined;

    if (!attempt || attempt.user_id !== req.authUser!.id) {
      res.status(403).json({ error: 'Attempt access denied.' });
      return;
    }
    if (attempt.status !== 'in_progress') {
      res.status(409).json({ error: 'Examination has already been submitted.' });
      return;
    }

    const schema = z.object({
      questionId: z.number().int().positive(),
      answerText: z.string().max(20000).default(''),
      selectedOptionKey: z.string().max(120).default(''),
      isFlagged: z.boolean().default(false),
      currentSectionIdx: z.number().int().min(0).max(20).optional(),
      flaggedQuestions: z.array(z.number().int()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid answer payload.' });
      return;
    }

    const wc = countWords(parsed.data.answerText);
    db.prepare(
      `INSERT INTO student_answers (attempt_id, question_id, answer_text, selected_option_key, word_count, is_flagged, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(attempt_id, question_id) DO UPDATE SET
         answer_text = excluded.answer_text,
         selected_option_key = excluded.selected_option_key,
         word_count = excluded.word_count,
         is_flagged = excluded.is_flagged,
         updated_at = datetime('now')`
    ).run(
      attemptId,
      parsed.data.questionId,
      parsed.data.answerText,
      parsed.data.selectedOptionKey,
      wc,
      parsed.data.isFlagged ? 1 : 0
    );

    if (parsed.data.currentSectionIdx !== undefined || parsed.data.flaggedQuestions !== undefined) {
      db.prepare(
        `UPDATE exam_attempts
         SET current_section_idx = COALESCE(?, current_section_idx),
             flagged_questions_json = COALESCE(?, flagged_questions_json)
         WHERE id = ?`
      ).run(
        parsed.data.currentSectionIdx ?? null,
        parsed.data.flaggedQuestions ? JSON.stringify(parsed.data.flaggedQuestions) : null,
        attemptId
      );
    }

    res.json({ ok: true, wordCount: wc, serverTime: new Date().toISOString() });
  });

  router.post('/attempts/:id/recordings', requireAuth, async (req: AuthenticatedRequest, res) => {
    const attemptId = Number(req.params.id);
    const attempt = db
      .prepare('SELECT id, user_id, status FROM exam_attempts WHERE id = ?')
      .get(attemptId) as { id: number; user_id: number; status: string } | undefined;

    if (!attempt || attempt.user_id !== req.authUser!.id) {
      res.status(403).json({ error: 'Attempt access denied.' });
      return;
    }

    const schema = z.object({
      questionId: z.number().int().positive(),
      mimeType: z.string().regex(/^audio\/(webm|ogg|mp4|mpeg|wav)(;.*)?$/i),
      durationSeconds: z.number().int().min(1).max(600),
      audioBase64: z.string().min(16).max(12_000_000),
      clientTranscript: z.string().max(10000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid audio recording payload.' });
      return;
    }

    const safeFilename = `att_${attemptId}_q_${parsed.data.questionId}_${Date.now()}.webm`;
    const uploadsDir = getUploadsDir();
    const resolvedPath = path.resolve(uploadsDir, safeFilename);
    if (!resolvedPath.startsWith(uploadsDir + path.sep)) {
      res.status(400).json({ error: 'Invalid storage path.' });
      return;
    }

    const rawBase64 = parsed.data.audioBase64.replace(/^data:[^;]+;base64,/, '');
    fs.writeFileSync(resolvedPath, Buffer.from(rawBase64, 'base64'));

    const aiTranscript = await transcribeAudioWithGemini(resolvedPath, parsed.data.mimeType);
    const finalTranscript = aiTranscript || parsed.data.clientTranscript || '';

    const recIns = db
      .prepare(
        `INSERT INTO audio_recordings (attempt_id, question_id, user_id, mime_type, duration_seconds, file_path, transcript)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        attemptId,
        parsed.data.questionId,
        req.authUser!.id,
        parsed.data.mimeType,
        parsed.data.durationSeconds,
        safeFilename,
        finalTranscript
      );
    const recordingId = Number(recIns.lastInsertRowid);

    db.prepare(
      `INSERT INTO student_answers (attempt_id, question_id, answer_text, audio_recording_id, word_count, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(attempt_id, question_id) DO UPDATE SET
         audio_recording_id = excluded.audio_recording_id,
         answer_text = CASE WHEN length(excluded.answer_text) > 0 THEN excluded.answer_text ELSE student_answers.answer_text END,
         word_count = CASE WHEN length(excluded.answer_text) > 0 THEN excluded.word_count ELSE student_answers.word_count END,
         updated_at = datetime('now')`
    ).run(attemptId, parsed.data.questionId, finalTranscript, recordingId, countWords(finalTranscript));

    res.status(201).json({
      recordingId,
      transcript: finalTranscript,
    });
  });

  // Protected recording playback (only owner or admin)
  router.get('/recordings/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const rec = db
      .prepare('SELECT * FROM audio_recordings WHERE id = ?')
      .get(Number(req.params.id)) as
      | { id: number; user_id: number; file_path: string; mime_type: string }
      | undefined;

    if (!rec) {
      res.status(404).json({ error: 'Recording not found.' });
      return;
    }
    if (rec.user_id !== req.authUser!.id && req.authUser!.role !== 'admin') {
      res.status(403).json({ error: 'Protected recording access denied.' });
      return;
    }

    const uploadsDir = getUploadsDir();
    const fullPath = path.resolve(uploadsDir, rec.file_path);
    if (!fullPath.startsWith(uploadsDir + path.sep) || !fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Recording file missing.' });
      return;
    }
    res.setHeader('Content-Type', rec.mime_type);
    fs.createReadStream(fullPath).pipe(res);
  });

  router.post('/attempts/:id/submit', requireAuth, async (req: AuthenticatedRequest, res) => {
    const attemptId = Number(req.params.id);
    const attempt = db
      .prepare(
        `SELECT ea.*, ex.exam_family, ex.title as exam_title
         FROM exam_attempts ea
         JOIN examinations ex ON ex.id = ea.exam_id
         WHERE ea.id = ?`
      )
      .get(attemptId) as
      | {
          id: number;
          exam_id: number;
          user_id: number;
          attempt_number: number;
          status: string;
          expires_at: string;
          exam_family: ExamFamily;
          exam_title: string;
        }
      | undefined;

    if (!attempt || attempt.user_id !== req.authUser!.id) {
      res.status(403).json({ error: 'Attempt access denied.' });
      return;
    }

    // If already submitted, return existing reportId
    if (attempt.status !== 'in_progress') {
      const existingReport = db
        .prepare('SELECT id FROM result_reports WHERE attempt_id = ?')
        .get(attemptId) as { id: number } | undefined;
      res.json({ reportId: existingReport?.id ?? null, status: attempt.status });
      return;
    }

    // Server-side time validation (60-second network grace window)
    const serverTimeValid = Date.now() <= Date.parse(attempt.expires_at) + 60_000 ? 1 : 0;

    const sections = db
      .prepare('SELECT * FROM exam_sections WHERE exam_id = ? ORDER BY section_order ASC')
      .all(attempt.exam_id) as Array<{ id: number; skill: SkillName }>;

    const answers = db
      .prepare('SELECT * FROM student_answers WHERE attempt_id = ?')
      .all(attemptId) as Array<{
      question_id: number;
      answer_text: string;
      selected_option_key: string;
      word_count: number;
    }>;
    const answerByQ = new Map(answers.map((a) => [a.question_id, a]));

    const plan = getUserActivePlan(attempt.user_id);
    const allowAi = Boolean(plan.ai_assessment_enabled) || req.authUser!.role === 'admin';

    const skillBuckets: Record<
      SkillName,
      {
        objectiveCorrect: number;
        objectiveTotal: number;
        subjectiveScores: number[];
        subjectivePending: boolean;
      }
    > = {
      Listening: { objectiveCorrect: 0, objectiveTotal: 0, subjectiveScores: [], subjectivePending: false },
      Reading: { objectiveCorrect: 0, objectiveTotal: 0, subjectiveScores: [], subjectivePending: false },
      Writing: { objectiveCorrect: 0, objectiveTotal: 0, subjectiveScores: [], subjectivePending: false },
      Speaking: { objectiveCorrect: 0, objectiveTotal: 0, subjectiveScores: [], subjectivePending: false },
    };

    const presentSkills = new Set<SkillName>();
    const pendingFeedbackToInsert: Array<{
      skill: SkillName;
      questionId: number;
      status: 'completed' | 'unavailable' | 'pending_review';
      criteriaScores: unknown[];
      grammarIssues: string[];
      vocabularyNotes: string;
      coherenceNotes: string;
      fluencyNotes: string;
      pronunciationNotes: string;
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
      rawSummary: string;
    }> = [];

    let usedAiModel: string | null = null;

    for (const sec of sections) {
      presentSkills.add(sec.skill);
      const qRows = db
        .prepare('SELECT * FROM questions WHERE section_id = ? ORDER BY question_order ASC')
        .all(sec.id) as Array<{
        id: number;
        question_type: QuestionType;
        prompt: string;
        max_marks: number;
        correct_answer_json: string | null;
      }>;

      for (const q of qRows) {
        const ans = answerByQ.get(q.id);
        if (isSubjectiveQuestionType(q.question_type)) {
          const text = ans?.answer_text || '';
          if (!text.trim()) {
            skillBuckets[sec.skill].subjectiveScores.push(0);
            pendingFeedbackToInsert.push({
              skill: sec.skill,
              questionId: q.id,
              status: 'completed',
              criteriaScores: [],
              grammarIssues: [],
              vocabularyNotes: 'No response submitted for this task.',
              coherenceNotes: '',
              fluencyNotes: '',
              pronunciationNotes: '',
              strengths: [],
              weaknesses: ['Task left unanswered'],
              recommendations: ['Ensure every Writing and Speaking prompt receives a complete response before submitting.'],
              rawSummary: 'No written or spoken transcript was provided for this task.',
            });
          } else if (!allowAi) {
            skillBuckets[sec.skill].subjectivePending = true;
            pendingFeedbackToInsert.push({
              skill: sec.skill,
              questionId: q.id,
              status: 'pending_review',
              criteriaScores: [],
              grammarIssues: [],
              vocabularyNotes: '',
              coherenceNotes: '',
              fluencyNotes: '',
              pronunciationNotes: '',
              strengths: [],
              weaknesses: [],
              recommendations: ['Upgrade to Comprehensive AI or wait for examiner moderation.'],
              rawSummary:
                'Response saved and queued for examiner review (AI evaluation requires Comprehensive plan or examiner review).',
            });
          } else {
            const aiOut = await assessResponseWithGemini({
              examFamily: attempt.exam_family,
              skill: sec.skill,
              prompt: q.prompt,
              responseText: text,
              wordCount: countWords(text),
            });

            if (aiOut.status === 'completed' && aiOut.estimatedScore !== null) {
              usedAiModel = aiOut.modelVersion;
              skillBuckets[sec.skill].subjectiveScores.push(aiOut.estimatedScore);
              pendingFeedbackToInsert.push({
                skill: sec.skill,
                questionId: q.id,
                status: 'completed',
                criteriaScores: aiOut.criteriaScores,
                grammarIssues: aiOut.grammarIssues,
                vocabularyNotes: aiOut.vocabularyNotes,
                coherenceNotes: aiOut.coherenceNotes,
                fluencyNotes: aiOut.fluencyNotes,
                pronunciationNotes: aiOut.pronunciationNotes,
                strengths: aiOut.strengths,
                weaknesses: aiOut.weaknesses,
                recommendations: aiOut.recommendations,
                rawSummary: aiOut.rawSummary,
              });
            } else {
              skillBuckets[sec.skill].subjectivePending = true;
              pendingFeedbackToInsert.push({
                skill: sec.skill,
                questionId: q.id,
                status: 'unavailable',
                criteriaScores: [],
                grammarIssues: [],
                vocabularyNotes: '',
                coherenceNotes: '',
                fluencyNotes: '',
                pronunciationNotes: '',
                strengths: [],
                weaknesses: [],
                recommendations: [],
                rawSummary: aiOut.rawSummary,
              });
            }
          }
        } else {
          const expected = q.correct_answer_json ? JSON.parse(q.correct_answer_json) : null;
          skillBuckets[sec.skill].objectiveTotal += q.max_marks;
          const earned = gradeObjectiveAnswer(
            q.question_type,
            expected,
            ans?.selected_option_key,
            ans?.answer_text,
            q.max_marks
          );
          skillBuckets[sec.skill].objectiveCorrect += earned;
        }
      }
    }

    const computedSkills: Array<{
      skill: SkillName;
      score: number;
      maxScore: number;
      label: string;
      isPending: boolean;
    }> = [];
    let anyPending = false;

    for (const skill of presentSkills) {
      const b = skillBuckets[skill];
      if (b.subjectivePending) anyPending = true;

      let score = 0;
      let maxScore = 9;
      let label = 'Pending';
      let isPending = false;

      const hasObj = b.objectiveTotal > 0;
      const hasSubj = b.subjectiveScores.length > 0;

      if (attempt.exam_family === 'IELTS_ACADEMIC' || attempt.exam_family === 'IELTS_GENERAL') {
        maxScore = 9;
        if (hasObj && !hasSubj) {
          score = rawRatioToIeltsBand(b.objectiveCorrect, b.objectiveTotal);
          label = `Band ${score.toFixed(1)}`;
        } else if (hasSubj) {
          const avgSubj = b.subjectiveScores.reduce((a, c) => a + c, 0) / b.subjectiveScores.length;
          score = roundIeltsBand(avgSubj);
          isPending = b.subjectivePending;
          label = b.subjectivePending ? 'Pending Review' : `Band ${score.toFixed(1)}`;
        } else {
          isPending = b.subjectivePending;
        }
      } else if (attempt.exam_family === 'PTE_ACADEMIC') {
        maxScore = 90;
        if (hasObj && !hasSubj) {
          score = rawRatioToPteScore(b.objectiveCorrect, b.objectiveTotal);
          label = `${score} / 90`;
        } else if (hasSubj) {
          const avgSubj = b.subjectiveScores.reduce((a, c) => a + c, 0) / b.subjectiveScores.length;
          score = Math.max(10, Math.min(90, Math.round(avgSubj)));
          isPending = b.subjectivePending;
          label = b.subjectivePending ? 'Pending Review' : `${score} / 90`;
        } else {
          isPending = b.subjectivePending;
        }
      } else if (attempt.exam_family === 'TOEFL_IBT') {
        maxScore = 30;
        if (hasObj && !hasSubj) {
          score = rawRatioToToeflSectionScore(b.objectiveCorrect, b.objectiveTotal);
          label = `${score} / 30`;
        } else if (hasSubj) {
          score = Math.max(0, Math.min(30, Math.round(b.subjectiveScores.reduce((a, c) => a + c, 0) / b.subjectiveScores.length)));
          isPending = b.subjectivePending;
          label = b.subjectivePending ? 'Pending Review' : `${score} / 30`;
        } else {
          isPending = b.subjectivePending;
        }
      } else {
        maxScore = 100;
        if (hasObj && !hasSubj) {
          score = b.objectiveTotal > 0 ? Math.round((b.objectiveCorrect / b.objectiveTotal) * 100) : 0;
          label = `${score}%`;
        } else if (hasSubj) {
          score = Math.round(b.subjectiveScores.reduce((a, c) => a + c, 0) / b.subjectiveScores.length);
          isPending = b.subjectivePending;
          label = b.subjectivePending ? 'Pending Review' : `${score}%`;
        } else {
          isPending = b.subjectivePending;
        }
      }

      computedSkills.push({ skill, score, maxScore, label, isPending });
    }

    const gradedSkills = computedSkills.filter((s) => !s.isPending);
    const overall = computeOverallScore(
      attempt.exam_family,
      gradedSkills.length > 0 ? gradedSkills : computedSkills
    );
    const finalStatus = anyPending ? 'pending' : 'completed';
    const attemptStatus = anyPending ? 'pending_review' : 'completed';

    const reportId = db.transaction(() => {
      db.prepare(
        `UPDATE exam_attempts SET status = ?, submitted_at = datetime('now'), server_time_valid = ? WHERE id = ?`
      ).run(attemptStatus, serverTimeValid, attemptId);

      const resInsert = db
        .prepare(
          `INSERT INTO assessment_results (attempt_id, overall_score, overall_label, cefr_level, status, ai_model_version, published_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .run(
          attemptId,
          overall.overallScore,
          anyPending ? `${overall.overallLabel} (Partial)` : overall.overallLabel,
          overall.cefrLevel,
          finalStatus,
          usedAiModel
        );
      const resultId = Number(resInsert.lastInsertRowid);

      const insSkill = db.prepare(
        `INSERT INTO skill_scores (result_id, skill, score, max_score, band_or_scale_label, criteria_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const s of computedSkills) {
        const fbCriteria =
          pendingFeedbackToInsert.find((f) => f.skill === s.skill)?.criteriaScores ?? [];
        insSkill.run(resultId, s.skill, s.score, s.maxScore, s.label, JSON.stringify(fbCriteria));
      }

      const insFb = db.prepare(
        `INSERT INTO ai_feedback (result_id, skill, question_id, criteria_scores_json, grammar_issues_json, vocabulary_notes, coherence_notes, fluency_notes, pronunciation_notes, strengths_json, weaknesses_json, recommendations_json, raw_summary, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const f of pendingFeedbackToInsert) {
        insFb.run(
          resultId,
          f.skill,
          f.questionId,
          JSON.stringify(f.criteriaScores),
          JSON.stringify(f.grammarIssues),
          f.vocabularyNotes,
          f.coherenceNotes,
          f.fluencyNotes,
          f.pronunciationNotes,
          JSON.stringify(f.strengths),
          JSON.stringify(f.weaknesses),
          JSON.stringify(f.recommendations),
          f.rawSummary,
          f.status
        );
      }

      const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const reportRef = `MRD-RPT-${new Date().getFullYear()}-${suffix}`;
      const verifyCode = `MRD-${new Date().getFullYear()}-${suffix}`;
      const candidateRef = `CAN-${String(attempt.user_id).padStart(5, '0')}`;

      const repIns = db
        .prepare(
          `INSERT INTO result_reports (result_id, attempt_id, user_id, candidate_ref, report_ref, verification_code, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(resultId, attemptId, attempt.user_id, candidateRef, reportRef, verifyCode, finalStatus);
      const newReportId = Number(repIns.lastInsertRowid);

      db.prepare(
        'INSERT INTO result_verifications (report_id, verification_code) VALUES (?, ?)'
      ).run(newReportId, verifyCode);

      db.prepare(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES (?, ?, ?, 'result')`
      ).run(
        attempt.user_id,
        `${attempt.exam_title} Submitted`,
        anyPending
          ? `Report ${reportRef} generated with objective scores. Subjective responses are pending examiner review.`
          : `Your unofficial report ${reportRef} (${overall.overallLabel}) is ready.`
      );

      return newReportId;
    })();

    res.json({ reportId, status: finalStatus });
  });

  // ---------------- RESULTS & PDF REPORTS ----------------
  router.get('/reports', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT rr.id as report_id, rr.report_ref, rr.verification_code, rr.status, rr.generated_at,
                ar.overall_score, ar.overall_label, ar.cefr_level,
                ex.title as exam_title, ex.exam_family, ea.attempt_number
         FROM result_reports rr
         JOIN assessment_results ar ON ar.id = rr.result_id
         JOIN exam_attempts ea ON ea.id = rr.attempt_id
         JOIN examinations ex ON ex.id = ea.exam_id
         WHERE rr.user_id = ?
         ORDER BY rr.generated_at DESC`
      )
      .all(req.authUser!.id);
    res.json({ reports: rows });
  });

  router.get('/reports/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const reportId = Number(req.params.id);
    const owner = db
      .prepare('SELECT user_id FROM result_reports WHERE id = ?')
      .get(reportId) as { user_id: number } | undefined;

    if (!owner) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    if (owner.user_id !== req.authUser!.id && req.authUser!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const detail = buildReportDetail(reportId);
    if (!detail) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const baseUrl =
      process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
        ? process.env.APP_URL.replace(/\/$/, '')
        : `${req.protocol}://${req.get('host')}`;
    const verifyUrl = `${baseUrl}/verify/${detail.verificationCode}`;
    const qrDataUrl = await generateQrDataUrl(verifyUrl);

    res.json({ report: detail, verifyUrl, qrDataUrl });
  });

  router.get('/reports/:id/pdf', requireAuth, async (req: AuthenticatedRequest, res) => {
    const reportId = Number(req.params.id);
    const owner = db
      .prepare('SELECT user_id FROM result_reports WHERE id = ?')
      .get(reportId) as { user_id: number } | undefined;

    if (!owner) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    if (owner.user_id !== req.authUser!.id && req.authUser!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const plan = getUserActivePlan(owner.user_id);
    if (!plan.pdf_reports_enabled && req.authUser!.role !== 'admin') {
      res.status(403).json({ error: 'Downloadable PDF reports require a Standard, Comprehensive, or Institutional plan.' });
      return;
    }

    const detail = buildReportDetail(reportId);
    if (!detail) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const baseUrl =
      process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
        ? process.env.APP_URL.replace(/\/$/, '')
        : `${req.protocol}://${req.get('host')}`;
    const verifyUrl = `${baseUrl}/verify/${detail.verificationCode}`;
    const pdfBuffer = await generateReportPdfBuffer(detail, verifyUrl);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${detail.reportRef}.pdf"`);
    res.send(pdfBuffer);
  });

  // ---------------- SUBSCRIPTIONS & PAYMENTS ----------------
  router.get('/plans', (_req, res) => {
    const plans = db
      .prepare('SELECT * FROM subscription_plans WHERE active = 1 ORDER BY price_cents ASC')
      .all() as Array<Record<string, unknown>>;
    res.json({
      plans: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        priceCents: p.price_cents,
        currency: p.currency,
        durationDays: p.duration_days,
        maxMonthlyAttempts: p.max_monthly_attempts,
        aiAssessmentEnabled: Boolean(p.ai_assessment_enabled),
        pdfReportsEnabled: Boolean(p.pdf_reports_enabled),
        features: JSON.parse(String(p.features_json || '[]')),
        discountPercent: p.discount_percent,
        active: Boolean(p.active),
      })),
      paymentMode: process.env.PAYMENT_PROVIDER_MODE || 'sandbox',
    });
  });

  router.post('/payments/checkout', requireAuth, (req: AuthenticatedRequest, res) => {
    const mode = process.env.PAYMENT_PROVIDER_MODE || 'sandbox';
    if (mode === 'disabled') {
      res.status(503).json({ error: 'Online payments are not currently enabled.' });
      return;
    }

    const schema = z.object({ planCode: z.enum(['BASIC', 'PREMIUM', 'INSTITUTIONAL']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid subscription plan selected.' });
      return;
    }

    const plan = db
      .prepare('SELECT * FROM subscription_plans WHERE code = ? AND active = 1')
      .get(parsed.data.planCode) as
      | { id: number; code: AccessTier; name: string; price_cents: number; discount_percent: number; currency: string }
      | undefined;

    if (!plan) {
      res.status(404).json({ error: 'Plan not found.' });
      return;
    }

    const finalCents = Math.round(plan.price_cents * (1 - plan.discount_percent / 100));
    const providerRef = `PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    db.prepare(
      `INSERT INTO payment_records (user_id, plan_id, provider, provider_ref, amount_cents, currency, status, webhook_verified)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)`
    ).run(req.authUser!.id, plan.id, mode === 'sandbox' ? 'sandbox_gateway' : 'configured_provider', providerRef, finalCents, plan.currency);

    res.status(201).json({
      providerRef,
      amountCents: finalCents,
      currency: plan.currency,
      status: 'pending',
      paymentMode: mode,
      message: 'Payment intent recorded as pending. Paid access unlocks only upon verified webhook confirmation.',
    });
  });

  function processVerifiedPayment(providerRef: string) {
    const payment = db
      .prepare('SELECT * FROM payment_records WHERE provider_ref = ?')
      .get(providerRef) as
      | { id: number; user_id: number; plan_id: number; status: string }
      | undefined;

    if (!payment) return false;
    if (payment.status === 'paid') return true;

    const plan = db
      .prepare('SELECT id, name, duration_days FROM subscription_plans WHERE id = ?')
      .get(payment.plan_id) as { id: number; name: string; duration_days: number };

    db.transaction(() => {
      db.prepare(
        "UPDATE payment_records SET status = 'paid', webhook_verified = 1 WHERE id = ?"
      ).run(payment.id);

      db.prepare(
        "UPDATE subscriptions SET status = 'expired' WHERE user_id = ? AND status = 'active'"
      ).run(payment.user_id);

      db.prepare(
        `INSERT INTO subscriptions (user_id, plan_id, status, starts_at, expires_at, attempts_used)
         VALUES (?, ?, 'active', datetime('now'), datetime('now', ?), 0)`
      ).run(payment.user_id, plan.id, `+${plan.duration_days} days`);

      db.prepare(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES (?, ?, ?, 'billing')`
      ).run(
        payment.user_id,
        `${plan.name} Activated`,
        `Payment ${providerRef} was verified and your ${plan.name} subscription is now active.`
      );

      logAudit(payment.user_id, 'system_webhook', 'PAYMENT_WEBHOOK_VERIFIED', 'payment_record', payment.id, 'Verified payment webhook', {
        providerRef,
      });
    })();

    return true;
  }

  // Real HMAC-verified payment webhook endpoint
  router.post('/payments/webhook', (req, res) => {
    const signature = String(req.headers['x-meridian-signature'] || '');
    const payloadStr = JSON.stringify(req.body || {});
    const expected = crypto
      .createHmac('sha256', getWebhookSecret())
      .update(payloadStr)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(401).json({ error: 'Invalid webhook signature.' });
      return;
    }

    const schema = z.object({
      event: z.literal('payment.succeeded'),
      providerRef: z.string().min(4),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid webhook payload.' });
      return;
    }

    const ok = processVerifiedPayment(parsed.data.providerRef);
    if (!ok) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }
    res.json({ received: true, verified: true });
  });

  // Sandbox-only helper that performs an internal HMAC-signed webhook verification for preview testing
  router.post('/payments/sandbox-confirm/:providerRef', requireAuth, (req: AuthenticatedRequest, res) => {
    const mode = process.env.PAYMENT_PROVIDER_MODE || 'sandbox';
    if (mode !== 'sandbox') {
      res.status(403).json({ error: 'Sandbox payment confirmation is disabled in live mode.' });
      return;
    }
    const payment = db
      .prepare('SELECT user_id, provider_ref FROM payment_records WHERE provider_ref = ?')
      .get(req.params.providerRef) as { user_id: number; provider_ref: string } | undefined;

    if (!payment || payment.user_id !== req.authUser!.id) {
      res.status(404).json({ error: 'Pending payment record not found.' });
      return;
    }

    processVerifiedPayment(payment.provider_ref);
    res.json({ ok: true, status: 'paid', webhookVerified: true });
  });

  // ---------------- ADMINISTRATOR PORTAL ----------------
  router.get('/admin/bootstrap-status', (_req, res) => {
    const adminCount = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND status = 'active'").get() as {
        c: number;
      }
    ).c;
    const envConfigured = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    res.json({
      needsSetup: adminCount === 0 && !envConfigured,
      envPasscodeConfigured: envConfigured,
    });
  });

  router.post('/admin/claim', authRateLimiter, (req, res) => {
    const adminCount = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND status = 'active'").get() as {
        c: number;
      }
    ).c;
    const envConfigured = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    if (adminCount > 0 || envConfigured) {
      res.status(403).json({ error: 'Administrator setup has already been claimed or configured.' });
      return;
    }

    const schema = z.object({
      email: z.string().trim().email(),
      fullName: z.string().trim().min(2).max(120),
      password: z.string().min(8).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Provide a valid email, full name, and 8+ character password.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(parsed.data.email.toLowerCase());
    if (existing) {
      res.status(409).json({ error: 'That email is already registered.' });
      return;
    }

    const userId = db.transaction(() => {
      const u = db
        .prepare(
          `INSERT INTO users (email, password_hash, role, email_verified, status)
           VALUES (?, ?, 'admin', 1, 'active')`
        )
        .run(parsed.data.email.toLowerCase(), hashPassword(parsed.data.password));
      const uid = Number(u.lastInsertRowid);
      db.prepare('INSERT INTO admin_users (user_id, full_name, admin_role) VALUES (?, ?, ?)').run(
        uid,
        parsed.data.fullName,
        'super_admin'
      );
      logAudit(uid, 'admin', 'ADMIN_CLAIMED', 'user', uid, 'Initial administrator setup completed');
      return uid;
    })();

    const token = createSessionToken(userId, 'admin');
    setSessionCookie(res, token);
    res.status(201).json({
      token,
      user: {
        id: userId,
        email: parsed.data.email.toLowerCase(),
        role: 'admin',
        emailVerified: true,
        status: 'active',
        fullName: parsed.data.fullName,
        planCode: 'INSTITUTIONAL',
        planName: 'Administrator',
      },
    });
  });

  router.post('/admin/login', authRateLimiter, (req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const { email, password, passcode } = req.body || {};

    if (envPasscode && typeof passcode === 'string' && passcode.length > 0) {
      const a = Buffer.from(passcode);
      const b = Buffer.from(envPasscode);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        // Find or ensure an admin user row for env passcode sessions
        let adminRow = db
          .prepare("SELECT id, email FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1")
          .get() as { id: number; email: string } | undefined;
        if (!adminRow) {
          const ins = db
            .prepare(
              `INSERT INTO users (email, password_hash, role, email_verified, status)
               VALUES ('admin@meridian-assessment.org', ?, 'admin', 1, 'active')`
            )
            .run(hashPassword(envPasscode));
          const uid = Number(ins.lastInsertRowid);
          db.prepare('INSERT INTO admin_users (user_id, full_name, admin_role) VALUES (?, ?, ?)').run(
            uid,
            'Chief Examiner',
            'super_admin'
          );
          adminRow = { id: uid, email: 'admin@meridian-assessment.org' };
        }
        const token = createSessionToken(adminRow.id, 'admin');
        setSessionCookie(res, token);
        res.json({
          token,
          user: {
            id: adminRow.id,
            email: adminRow.email,
            role: 'admin',
            emailVerified: true,
            status: 'active',
            fullName: 'Chief Examiner',
            planCode: 'INSTITUTIONAL',
            planName: 'Administrator',
          },
        });
        return;
      }
      res.status(401).json({ error: 'Invalid administrator passcode.' });
      return;
    }

    const schema = z.object({
      email: z.string().trim().email(),
      password: z.string().min(1),
    });
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      res.status(400).json({ error: 'Administrator email and password required.' });
      return;
    }

    const user = db
      .prepare("SELECT * FROM users WHERE email = ? AND role = 'admin' AND status = 'active'")
      .get(parsed.data.email.toLowerCase()) as
      | { id: number; email: string; password_hash: string }
      | undefined;

    if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    const adm = db
      .prepare('SELECT full_name FROM admin_users WHERE user_id = ?')
      .get(user.id) as { full_name: string } | undefined;

    const token = createSessionToken(user.id, 'admin');
    setSessionCookie(res, token);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: 'admin',
        emailVerified: true,
        status: 'active',
        fullName: adm?.full_name || 'Administrator',
        planCode: 'INSTITUTIONAL',
        planName: 'Administrator',
      },
    });
  });

  router.get('/admin/overview', requireAdmin, (_req, res) => {
    const totalStudents = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student' AND status != 'deleted'").get() as { c: number }
    ).c;
    const totalExams = (db.prepare('SELECT COUNT(*) as c FROM examinations').get() as { c: number }).c;
    const totalAttempts = (db.prepare('SELECT COUNT(*) as c FROM exam_attempts').get() as { c: number }).c;
    const pendingReviews = (
      db.prepare("SELECT COUNT(*) as c FROM assessment_results WHERE status = 'pending'").get() as { c: number }
    ).c;
    const revenueCents = (
      db.prepare("SELECT COALESCE(SUM(amount_cents), 0) as total FROM payment_records WHERE status = 'paid'").get() as {
        total: number;
      }
    ).total;

    const examsByFamily = db
      .prepare(
        `SELECT ex.exam_family as name, COUNT(ea.id) as attempts
         FROM examinations ex
         LEFT JOIN exam_attempts ea ON ea.exam_id = ex.id
         GROUP BY ex.exam_family`
      )
      .all();

    const auditLogs = db
      .prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 20')
      .all();

    res.json({
      kpis: {
        totalStudents,
        totalExams,
        totalAttempts,
        pendingReviews,
        revenueUsd: Math.round(revenueCents) / 100,
      },
      examsByFamily,
      auditLogs,
    });
  });

  router.get('/admin/students', requireAdmin, (req, res) => {
    const q = String(req.query.q || '').trim();
    const rows = db
      .prepare(
        `SELECT u.id, u.email, u.email_verified, u.status, u.created_at,
                sp.full_name, sp.country, sp.preferred_exam, sp.target_score, sp.education_level,
                (SELECT p.code FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.user_id = u.id AND s.status = 'active' ORDER BY s.id DESC LIMIT 1) as plan_code,
                (SELECT COUNT(*) FROM exam_attempts ea WHERE ea.user_id = u.id) as attempts_count
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE u.role = 'student' AND (? = '' OR u.email LIKE ? OR sp.full_name LIKE ?)
         ORDER BY u.id DESC`
      )
      .all(q, `%${q}%`, `%${q}%`);
    res.json({ students: rows });
  });

  router.patch('/admin/students/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    const targetId = Number(req.params.id);
    const schema = z.object({
      status: z.enum(['active', 'suspended']).optional(),
      targetScore: z.string().trim().max(20).optional(),
      preferredExam: z.string().trim().max(40).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid student update payload.' });
      return;
    }

    if (parsed.data.status) {
      db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ? AND role = 'student'").run(
        parsed.data.status,
        targetId
      );
    }
    if (parsed.data.targetScore || parsed.data.preferredExam) {
      db.prepare(
        `UPDATE student_profiles
         SET target_score = COALESCE(?, target_score),
             preferred_exam = COALESCE(?, preferred_exam),
             updated_at = datetime('now')
         WHERE user_id = ?`
      ).run(parsed.data.targetScore ?? null, parsed.data.preferredExam ?? null, targetId);
    }
    logAudit(req.authUser!.id, 'admin', 'STUDENT_UPDATED', 'user', targetId, 'Admin student update');
    res.json({ ok: true });
  });

  router.get('/admin/exams', requireAdmin, (_req, res) => {
    const exams = db
      .prepare(
        `SELECT e.*,
                (SELECT COUNT(*) FROM exam_sections s WHERE s.exam_id = e.id) as section_count,
                (SELECT COUNT(*) FROM questions q JOIN exam_sections s ON s.id = q.section_id WHERE s.exam_id = e.id) as question_count
         FROM examinations e ORDER BY e.id DESC`
      )
      .all();
    res.json({ exams });
  });

  router.post('/admin/exams', requireAdmin, (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      title: z.string().trim().min(3).max(160),
      examFamily: z.enum(['IELTS_ACADEMIC', 'IELTS_GENERAL', 'PTE_ACADEMIC', 'TOEFL_IBT', 'GENERAL_ENGLISH']),
      category: z.enum(['Full Mock', 'Mini Mock', 'Skill Practice']),
      primarySkill: z.enum(['All', 'Listening', 'Reading', 'Writing', 'Speaking']),
      difficulty: z.enum(['Foundation', 'Intermediate', 'Advanced']),
      durationMinutes: z.number().int().min(5).max(240),
      accessTier: z.enum(['FREE', 'BASIC', 'PREMIUM', 'INSTITUTIONAL']),
      sectionTitle: z.string().trim().min(2).max(160),
      sectionSkill: z.enum(['Listening', 'Reading', 'Writing', 'Speaking']),
      instructions: z.string().trim().min(5).max(1000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid examination configuration.' });
      return;
    }

    const slug = `${parsed.data.examFamily.toLowerCase()}-${Date.now()}`;
    const examId = db.transaction(() => {
      const ex = db
        .prepare(
          `INSERT INTO examinations (slug, title, exam_family, category, primary_skill, difficulty, duration_minutes, access_tier, published, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
        )
        .run(
          slug,
          parsed.data.title,
          parsed.data.examFamily,
          parsed.data.category,
          parsed.data.primarySkill,
          parsed.data.difficulty,
          parsed.data.durationMinutes,
          parsed.data.accessTier,
          req.authUser!.id
        );
      const eid = Number(ex.lastInsertRowid);
      db.prepare(
        `INSERT INTO exam_sections (exam_id, title, skill, section_order, duration_minutes, instructions)
         VALUES (?, ?, ?, 1, ?, ?)`
      ).run(eid, parsed.data.sectionTitle, parsed.data.sectionSkill, parsed.data.durationMinutes, parsed.data.instructions);

      logAudit(req.authUser!.id, 'admin', 'EXAM_CREATED', 'examination', eid, 'Created new examination template');
      return eid;
    })();

    res.status(201).json({ id: examId, slug });
  });

  router.patch('/admin/exams/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    const examId = Number(req.params.id);
    const schema = z.object({
      title: z.string().trim().min(3).max(160).optional(),
      durationMinutes: z.number().int().min(5).max(240).optional(),
      accessTier: z.enum(['FREE', 'BASIC', 'PREMIUM', 'INSTITUTIONAL']).optional(),
      published: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid exam update payload.' });
      return;
    }

    db.prepare(
      `UPDATE examinations
       SET title = COALESCE(?, title),
           duration_minutes = COALESCE(?, duration_minutes),
           access_tier = COALESCE(?, access_tier),
           published = COALESCE(?, published),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      parsed.data.title ?? null,
      parsed.data.durationMinutes ?? null,
      parsed.data.accessTier ?? null,
      parsed.data.published === undefined ? null : parsed.data.published ? 1 : 0,
      examId
    );
    logAudit(req.authUser!.id, 'admin', 'EXAM_UPDATED', 'examination', examId, 'Updated exam metadata');
    res.json({ ok: true });
  });

  router.post('/admin/exams/:id/questions', requireAdmin, (req: AuthenticatedRequest, res) => {
    const examId = Number(req.params.id);
    const section = db
      .prepare('SELECT id FROM exam_sections WHERE exam_id = ? ORDER BY section_order ASC LIMIT 1')
      .get(examId) as { id: number } | undefined;
    if (!section) {
      res.status(404).json({ error: 'Examination section not found.' });
      return;
    }

    const schema = z.object({
      questionType: z.string().min(2).max(60),
      prompt: z.string().trim().min(5).max(2000),
      maxMarks: z.number().min(1).max(100).default(1),
      correctAnswer: z.string().max(500).optional(),
      options: z.array(z.object({ key: z.string(), text: z.string(), isCorrect: z.boolean().optional() })).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid question payload.' });
      return;
    }

    const qCount = (
      db.prepare('SELECT COUNT(*) as c FROM questions WHERE section_id = ?').get(section.id) as { c: number }
    ).c;

    const qRes = db
      .prepare(
        `INSERT INTO questions (section_id, question_order, question_type, prompt, max_marks, correct_answer_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        section.id,
        qCount + 1,
        parsed.data.questionType,
        parsed.data.prompt,
        parsed.data.maxMarks,
        parsed.data.correctAnswer ? JSON.stringify(parsed.data.correctAnswer) : null
      );
    const qid = Number(qRes.lastInsertRowid);

    if (parsed.data.options) {
      const insOpt = db.prepare(
        'INSERT INTO question_options (question_id, option_key, option_text, is_correct) VALUES (?, ?, ?, ?)'
      );
      for (const opt of parsed.data.options) {
        insOpt.run(qid, opt.key, opt.text, opt.isCorrect ? 1 : 0);
      }
    }

    logAudit(req.authUser!.id, 'admin', 'QUESTION_ADDED', 'question', qid, `Added to exam ${examId}`);
    res.status(201).json({ id: qid });
  });

  router.get('/admin/submissions', requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT ea.id as attempt_id, ea.attempt_number, ea.status as attempt_status, ea.submitted_at, ea.server_time_valid,
                ex.title as exam_title, ex.exam_family,
                sp.full_name as student_name, u.email as student_email,
                ar.id as result_id, ar.overall_score, ar.overall_label, ar.status as result_status, ar.review_notes,
                rr.id as report_id, rr.report_ref
         FROM exam_attempts ea
         JOIN examinations ex ON ex.id = ea.exam_id
         JOIN users u ON u.id = ea.user_id
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         LEFT JOIN assessment_results ar ON ar.attempt_id = ea.id
         LEFT JOIN result_reports rr ON rr.attempt_id = ea.id
         WHERE ea.status != 'in_progress'
         ORDER BY ea.id DESC`
      )
      .all();
    res.json({ submissions: rows });
  });

  router.get('/admin/submissions/:attemptId', requireAdmin, (req, res) => {
    const attemptId = Number(req.params.attemptId);
    const answers = db
      .prepare(
        `SELECT sa.question_id, sa.answer_text, sa.selected_option_key, sa.word_count, sa.audio_recording_id,
                q.question_type, q.prompt, q.max_marks, s.skill
         FROM student_answers sa
         JOIN questions q ON q.id = sa.question_id
         JOIN exam_sections s ON s.id = q.section_id
         WHERE sa.attempt_id = ?
         ORDER BY q.question_order ASC`
      )
      .all(attemptId);
    const reportRow = db
      .prepare('SELECT id FROM result_reports WHERE attempt_id = ?')
      .get(attemptId) as { id: number } | undefined;
    const report = reportRow ? buildReportDetail(reportRow.id) : null;
    res.json({ answers, report });
  });

  router.patch('/admin/results/:resultId/review', requireAdmin, (req: AuthenticatedRequest, res) => {
    const resultId = Number(req.params.resultId);
    const schema = z.object({
      status: z.enum(['completed', 'reviewed', 'invalidated']),
      reason: z.string().trim().min(5).max(500),
      skillOverrides: z.array(z.object({ skill: z.enum(['Listening', 'Reading', 'Writing', 'Speaking']), score: z.number().min(0).max(100) })).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Provide a valid status and documented moderation reason (5+ chars).' });
      return;
    }

    const resRow = db
      .prepare(
        `SELECT ar.id, ar.attempt_id, ex.exam_family
         FROM assessment_results ar
         JOIN exam_attempts ea ON ea.id = ar.attempt_id
         JOIN examinations ex ON ex.id = ea.exam_id
         WHERE ar.id = ?`
      )
      .get(resultId) as { id: number; attempt_id: number; exam_family: ExamFamily } | undefined;

    if (!resRow) {
      res.status(404).json({ error: 'Assessment result not found.' });
      return;
    }

    db.transaction(() => {
      if (parsed.data.skillOverrides && parsed.data.skillOverrides.length > 0) {
        for (const ov of parsed.data.skillOverrides) {
          const label =
            resRow.exam_family.startsWith('IELTS')
              ? `Band ${roundIeltsBand(ov.score).toFixed(1)}`
              : resRow.exam_family === 'PTE_ACADEMIC'
                ? `${Math.round(ov.score)} / 90`
                : resRow.exam_family === 'TOEFL_IBT'
                  ? `${Math.round(ov.score)} / 30`
                  : `${Math.round(ov.score)}%`;
          db.prepare(
            'UPDATE skill_scores SET score = ?, band_or_scale_label = ? WHERE result_id = ? AND skill = ?'
          ).run(ov.score, label, resultId, ov.skill);
        }
      }

      const updatedSkills = db
        .prepare('SELECT skill, score FROM skill_scores WHERE result_id = ?')
        .all(resultId) as Array<{ skill: SkillName; score: number }>;

      const overall = computeOverallScore(resRow.exam_family, updatedSkills);

      db.prepare(
        `UPDATE assessment_results
         SET overall_score = ?, overall_label = ?, cefr_level = ?, status = ?, reviewer_id = ?, review_notes = ?, published_at = datetime('now')
         WHERE id = ?`
      ).run(
        overall.overallScore,
        overall.overallLabel,
        overall.cefrLevel,
        parsed.data.status,
        req.authUser!.id,
        parsed.data.reason,
        resultId
      );

      db.prepare('UPDATE result_reports SET status = ? WHERE result_id = ?').run(parsed.data.status, resultId);
      db.prepare('UPDATE exam_attempts SET status = ? WHERE id = ?').run(parsed.data.status, resRow.attempt_id);

      logAudit(req.authUser!.id, 'admin', 'RESULT_MODERATED', 'assessment_result', resultId, parsed.data.reason, {
        status: parsed.data.status,
        overallLabel: overall.overallLabel,
      });
    })();

    res.json({ ok: true });
  });

  router.get('/admin/payments', requireAdmin, (_req, res) => {
    const payments = db
      .prepare(
        `SELECT pr.*, u.email as user_email, sp.full_name as student_name, p.code as plan_code, p.name as plan_name
         FROM payment_records pr
         JOIN users u ON u.id = pr.user_id
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         JOIN subscription_plans p ON p.id = pr.plan_id
         ORDER BY pr.id DESC`
      )
      .all();
    res.json({ payments });
  });

  router.patch('/admin/plans/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    const planId = Number(req.params.id);
    const schema = z.object({
      priceCents: z.number().int().min(0).max(500000).optional(),
      discountPercent: z.number().int().min(0).max(90).optional(),
      maxMonthlyAttempts: z.number().int().min(1).max(5000).optional(),
      aiAssessmentEnabled: z.boolean().optional(),
      pdfReportsEnabled: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid plan update payload.' });
      return;
    }

    db.prepare(
      `UPDATE subscription_plans
       SET price_cents = COALESCE(?, price_cents),
           discount_percent = COALESCE(?, discount_percent),
           max_monthly_attempts = COALESCE(?, max_monthly_attempts),
           ai_assessment_enabled = COALESCE(?, ai_assessment_enabled),
           pdf_reports_enabled = COALESCE(?, pdf_reports_enabled)
       WHERE id = ?`
    ).run(
      parsed.data.priceCents ?? null,
      parsed.data.discountPercent ?? null,
      parsed.data.maxMonthlyAttempts ?? null,
      parsed.data.aiAssessmentEnabled === undefined ? null : parsed.data.aiAssessmentEnabled ? 1 : 0,
      parsed.data.pdfReportsEnabled === undefined ? null : parsed.data.pdfReportsEnabled ? 1 : 0,
      planId
    );
    logAudit(req.authUser!.id, 'admin', 'PLAN_UPDATED', 'subscription_plan', planId, 'Updated pricing/limits');
    res.json({ ok: true });
  });

  router.get('/admin/content', requireAdmin, (_req, res) => {
    const resources = db.prepare('SELECT * FROM study_resources ORDER BY id DESC').all();
    const supportRequests = db.prepare('SELECT * FROM support_requests ORDER BY id DESC').all();
    res.json({ resources, supportRequests });
  });

  router.post('/admin/content', requireAdmin, (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      title: z.string().trim().min(3).max(200),
      examFamily: z.string().trim().min(2).max(40),
      skill: z.string().trim().min(2).max(40),
      resourceType: z.enum(['Article', 'Guide', 'FAQ', 'Banner']),
      summary: z.string().trim().min(4).max(300),
      content: z.string().trim().min(5).max(5000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid content payload.' });
      return;
    }
    const slug = `${parsed.data.resourceType.toLowerCase()}-${Date.now()}`;
    const ins = db
      .prepare(
        `INSERT INTO study_resources (slug, title, exam_family, skill, resource_type, summary, content, published)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        slug,
        parsed.data.title,
        parsed.data.examFamily,
        parsed.data.skill,
        parsed.data.resourceType,
        parsed.data.summary,
        parsed.data.content
      );
    logAudit(req.authUser!.id, 'admin', 'CONTENT_CREATED', 'study_resource', Number(ins.lastInsertRowid), parsed.data.title);
    res.status(201).json({ id: Number(ins.lastInsertRowid) });
  });

  router.delete('/admin/content/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM study_resources WHERE id = ?').run(id);
    logAudit(req.authUser!.id, 'admin', 'CONTENT_DELETED', 'study_resource', id, 'Removed CMS item');
    res.json({ ok: true });
  });

  return router;
}
