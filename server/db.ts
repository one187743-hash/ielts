import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const DB_PATH = path.join(DATA_DIR, 'meridian.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'institution_admin')),
      email_verified INTEGER NOT NULL DEFAULT 0,
      verification_code TEXT,
      reset_token TEXT,
      reset_expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS student_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      phone TEXT,
      country TEXT NOT NULL DEFAULT 'United Kingdom',
      city TEXT,
      date_of_birth TEXT,
      education_level TEXT NOT NULL DEFAULT 'Undergraduate',
      preferred_exam TEXT NOT NULL DEFAULT 'IELTS_ACADEMIC',
      target_score TEXT NOT NULL DEFAULT '7.5',
      intended_exam_date TEXT,
      objective TEXT NOT NULL DEFAULT 'University Admission',
      privacy_consent INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      admin_role TEXT NOT NULL DEFAULT 'super_admin',
      permissions_json TEXT NOT NULL DEFAULT '["all"]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE CHECK (code IN ('FREE', 'BASIC', 'PREMIUM', 'INSTITUTIONAL')),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      duration_days INTEGER NOT NULL DEFAULT 30,
      max_monthly_attempts INTEGER NOT NULL DEFAULT 3,
      ai_assessment_enabled INTEGER NOT NULL DEFAULT 0,
      pdf_reports_enabled INTEGER NOT NULL DEFAULT 0,
      features_json TEXT NOT NULL DEFAULT '[]',
      discount_percent INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
      starts_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      attempts_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
      provider TEXT NOT NULL DEFAULT 'stripe_compatible',
      provider_ref TEXT NOT NULL UNIQUE,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
      webhook_verified INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS examinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      exam_family TEXT NOT NULL CHECK (exam_family IN ('IELTS_ACADEMIC', 'IELTS_GENERAL', 'PTE_ACADEMIC', 'TOEFL_IBT', 'GENERAL_ENGLISH')),
      category TEXT NOT NULL CHECK (category IN ('Full Mock', 'Mini Mock', 'Skill Practice')),
      primary_skill TEXT NOT NULL CHECK (primary_skill IN ('All', 'Listening', 'Reading', 'Writing', 'Speaking')),
      difficulty TEXT NOT NULL DEFAULT 'Intermediate' CHECK (difficulty IN ('Foundation', 'Intermediate', 'Advanced')),
      duration_minutes INTEGER NOT NULL,
      access_tier TEXT NOT NULL DEFAULT 'FREE' CHECK (access_tier IN ('FREE', 'BASIC', 'PREMIUM', 'INSTITUTIONAL')),
      scoring_config_json TEXT NOT NULL DEFAULT '{}',
      published INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exam_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      skill TEXT NOT NULL CHECK (skill IN ('Listening', 'Reading', 'Writing', 'Speaking')),
      section_order INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      instructions TEXT NOT NULL,
      passage_title TEXT,
      passage_text TEXT,
      audio_script TEXT,
      audio_url TEXT
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL REFERENCES exam_sections(id) ON DELETE CASCADE,
      question_order INTEGER NOT NULL,
      question_type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      context_text TEXT,
      image_url TEXT,
      audio_url TEXT,
      prep_seconds INTEGER NOT NULL DEFAULT 0,
      record_seconds INTEGER NOT NULL DEFAULT 0,
      max_marks REAL NOT NULL DEFAULT 1,
      rubric_json TEXT NOT NULL DEFAULT '{}',
      correct_answer_json TEXT
    );

    CREATE TABLE IF NOT EXISTS question_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      option_key TEXT NOT NULL,
      option_text TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exam_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'pending_review', 'completed', 'reviewed', 'invalidated')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      submitted_at TEXT,
      current_section_idx INTEGER NOT NULL DEFAULT 0,
      flagged_questions_json TEXT NOT NULL DEFAULT '[]',
      server_time_valid INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS audio_recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mime_type TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      file_path TEXT NOT NULL,
      transcript TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS student_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      answer_text TEXT NOT NULL DEFAULT '',
      selected_option_key TEXT NOT NULL DEFAULT '',
      audio_recording_id INTEGER REFERENCES audio_recordings(id) ON DELETE SET NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(attempt_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS assessment_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL UNIQUE REFERENCES exam_attempts(id) ON DELETE CASCADE,
      overall_score REAL NOT NULL DEFAULT 0,
      overall_label TEXT NOT NULL DEFAULT 'Pending',
      cefr_level TEXT NOT NULL DEFAULT 'B1',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'reviewed', 'invalidated')),
      ai_model_version TEXT,
      reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      review_notes TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skill_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      result_id INTEGER NOT NULL REFERENCES assessment_results(id) ON DELETE CASCADE,
      skill TEXT NOT NULL CHECK (skill IN ('Listening', 'Reading', 'Writing', 'Speaking')),
      score REAL NOT NULL DEFAULT 0,
      max_score REAL NOT NULL DEFAULT 9,
      band_or_scale_label TEXT NOT NULL,
      criteria_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS ai_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      result_id INTEGER NOT NULL REFERENCES assessment_results(id) ON DELETE CASCADE,
      skill TEXT NOT NULL CHECK (skill IN ('Listening', 'Reading', 'Writing', 'Speaking')),
      question_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
      criteria_scores_json TEXT NOT NULL DEFAULT '[]',
      grammar_issues_json TEXT NOT NULL DEFAULT '[]',
      vocabulary_notes TEXT NOT NULL DEFAULT '',
      coherence_notes TEXT NOT NULL DEFAULT '',
      fluency_notes TEXT NOT NULL DEFAULT '',
      pronunciation_notes TEXT NOT NULL DEFAULT '',
      strengths_json TEXT NOT NULL DEFAULT '[]',
      weaknesses_json TEXT NOT NULL DEFAULT '[]',
      recommendations_json TEXT NOT NULL DEFAULT '[]',
      raw_summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'unavailable', 'pending_review')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS result_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      result_id INTEGER NOT NULL UNIQUE REFERENCES assessment_results(id) ON DELETE CASCADE,
      attempt_id INTEGER NOT NULL UNIQUE REFERENCES exam_attempts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      candidate_ref TEXT NOT NULL,
      report_ref TEXT NOT NULL UNIQUE,
      verification_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'reviewed', 'invalidated')),
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS result_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL UNIQUE REFERENCES result_reports(id) ON DELETE CASCADE,
      verification_code TEXT NOT NULL UNIQUE,
      verified_count INTEGER NOT NULL DEFAULT 0,
      last_verified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'system',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS study_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      exam_family TEXT NOT NULL,
      skill TEXT NOT NULL,
      resource_type TEXT NOT NULL CHECK (resource_type IN ('Article', 'Guide', 'FAQ', 'Banner')),
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS support_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reason TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_attempts_user ON exam_attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);
    CREATE INDEX IF NOT EXISTS idx_answers_attempt ON student_answers(attempt_id);
    CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(section_id);
    CREATE INDEX IF NOT EXISTS idx_reports_code ON result_reports(verification_code);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}
