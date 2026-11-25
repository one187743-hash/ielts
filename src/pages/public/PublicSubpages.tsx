import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, FileText, Search, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { ExamSummary, StudyResource, SubscriptionPlan } from '../../lib/types';

export function ExamFamilyPage({
  family,
  exams,
  onLaunchExam,
  onNavigate,
}: {
  family: 'IELTS' | 'PTE' | 'TOEFL' | 'GENERAL';
  exams: ExamSummary[];
  onLaunchExam: (slug: string) => void;
  onNavigate: (path: string) => void;
}) {
  const meta = {
    IELTS: {
      title: 'IELTS Academic & General Training Preparation',
      subtitle: 'Band 1.0 – 9.0 · Four-skill computer-delivered simulation',
      summary:
        'Prepare for university admission or skilled migration with authentic IELTS Academic and General Training mock examinations covering Listening, Reading, Writing Tasks 1 & 2, and Speaking Parts 1–3.',
      structure: [
        { skill: 'Listening', timing: '30 min', tasks: 'Multiple choice, form/sentence completion, matching, map labelling' },
        { skill: 'Reading', timing: '60 min', tasks: 'Academic or workplace passages, True/False/Not Given, Yes/No/Not Given, matching headings' },
        { skill: 'Writing', timing: '60 min', tasks: 'Task 1 (150+ words chart/letter) and Task 2 (250+ words essay) with live word counter' },
        { skill: 'Speaking', timing: '11–14 min', tasks: 'Part 1 interview, Part 2 cue card with 60s prep timer, Part 3 discussion' },
      ],
      filterFn: (e: ExamSummary) => e.examFamily.startsWith('IELTS'),
    },
    PTE: {
      title: 'PTE Academic Preparation & Mock Modules',
      subtitle: 'Scale 10 – 90 · Integrated computer-scored tasks',
      summary:
        'Practice every signature PTE Academic task type under strict preparation and recording timers, including Read Aloud, Repeat Sentence, Describe Image, Retell Lecture, Re-order Paragraphs, and Write from Dictation.',
      structure: [
        { skill: 'Speaking & Writing', timing: '54 min', tasks: 'Read Aloud, Repeat Sentence, Describe Image, Retell Lecture, Short Question, Summarize Written Text, Essay' },
        { skill: 'Reading', timing: '30 min', tasks: 'Reading & Writing Fill in the Blanks, Re-order Paragraphs, Multiple Choice' },
        { skill: 'Listening', timing: '30 min', tasks: 'Summarize Spoken Text, Listening Fill in the Blanks, Write from Dictation' },
        { skill: 'Scoring', timing: '10–90 Scale', tasks: 'Adjacent-pair scoring for Re-order, word-hit scoring for Dictation, rubric evaluation for extended responses' },
      ],
      filterFn: (e: ExamSummary) => e.examFamily === 'PTE_ACADEMIC',
    },
    TOEFL: {
      title: 'TOEFL iBT Preparation',
      subtitle: 'Scale 0 – 120 · Four 30-point academic sections',
      summary:
        'Simulate the modern TOEFL iBT examination format using configurable templates for Academic Reading, Campus Lecture Listening, Independent & Integrated Speaking, and Writing for an Academic Discussion.',
      structure: [
        { skill: 'Reading', timing: '35 min', tasks: 'Academic comprehension passages, inference, and vocabulary-in-context' },
        { skill: 'Listening', timing: '36 min', tasks: 'University lecture excerpts and campus seminar discussions' },
        { skill: 'Speaking', timing: '16 min', tasks: '15s prep / 45s timed speaking prompts with microphone recording' },
        { skill: 'Writing', timing: '29 min', tasks: 'Academic Discussion task and integrated synthesis writing' },
      ],
      filterFn: (e: ExamSummary) => e.examFamily === 'TOEFL_IBT',
    },
    GENERAL: {
      title: 'General English CEFR Proficiency Assessment',
      subtitle: 'CEFR A2 – C2 · Diagnostic benchmark',
      summary:
        'A concise 25-minute placement assessment designed for learners, academies, and employers seeking a rapid baseline across Listening, Grammar & Reading, and Written Reflection.',
      structure: [
        { skill: 'Listening', timing: '8 min', tasks: 'Everyday announcements and factual comprehension' },
        { skill: 'Grammar & Reading', timing: '10 min', tasks: 'Functional syntax and workplace reading accuracy' },
        { skill: 'Writing', timing: '7 min', tasks: 'Short structured written reflection' },
        { skill: 'Reporting', timing: 'Immediate', tasks: 'Percentage score mapped to CEFR A2–C2 levels' },
      ],
      filterFn: (e: ExamSummary) => e.examFamily === 'GENERAL_ENGLISH',
    },
  }[family];

  const matchingExams = exams.filter(meta.filterFn);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      <div className="border-b border-slate-200 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-3xl space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">
            {meta.subtitle}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0B1F3A]">{meta.title}</h1>
          <p className="text-slate-600 leading-relaxed">{meta.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {(['IELTS', 'PTE', 'TOEFL', 'GENERAL'] as const).map((tab) => {
            const pathMap = {
              IELTS: '/ielts',
              PTE: '/pte',
              TOEFL: '/toefl',
              GENERAL: '/general-english',
            };
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onNavigate(pathMap[tab])}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  family === tab
                    ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab === 'GENERAL' ? 'General English' : tab}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {meta.structure.map((s) => (
          <div key={s.skill} className="border border-slate-200 rounded-xl p-5 bg-[#F8FAFC]">
            <div className="text-xs font-mono-tabular font-semibold text-[#1D4ED8]">{s.timing}</div>
            <h2 className="text-base font-bold text-[#0B1F3A] mt-1">{s.skill}</h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{s.tasks}</p>
          </div>
        ))}
      </div>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-[#0B1F3A]">Available Practice &amp; Mock Examinations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matchingExams.map((exam) => (
            <div key={exam.id} className="border border-slate-200 rounded-xl p-6 bg-white flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 mb-2">
                  {exam.category} · {exam.durationMinutes} min · {exam.accessTier}
                </div>
                <h3 className="text-base font-bold text-[#0B1F3A]">{exam.title}</h3>
                <p className="text-xs text-slate-600 mt-2">
                  {exam.questionCount} items · Difficulty: {exam.difficulty}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onLaunchExam(exam.slug)}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg"
              >
                <span>Begin Assessment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function MockTestsPublicPage({
  exams,
  onLaunchExam,
}: {
  exams: ExamSummary[];
  onLaunchExam: (slug: string) => void;
}) {
  const [familyFilter, setFamilyFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');

  const filtered = exams.filter((e) => {
    if (familyFilter !== 'ALL' && !e.examFamily.startsWith(familyFilter)) return false;
    if (tierFilter !== 'ALL' && e.accessTier !== tierFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-[#0B1F3A]">Mock Test Library</h1>
        <p className="text-slate-600">
          Filter full mocks, mini mocks, and diagnostic assessments across all supported frameworks.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {['ALL', 'IELTS', 'PTE', 'TOEFL', 'GENERAL'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFamilyFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                familyFilter === f ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f === 'ALL' ? 'All Exams' : f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {['ALL', 'FREE', 'BASIC', 'PREMIUM'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tierFilter === t ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t === 'ALL' ? 'All Tiers' : t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((exam) => (
          <div key={exam.id} className="border border-slate-200 rounded-xl p-6 bg-white flex flex-col justify-between">
            <div>
              <div className="text-xs text-slate-500 mb-2">
                {exam.examFamily.replace('_', ' ')} · {exam.category} · {exam.accessTier}
              </div>
              <h2 className="text-base font-bold text-[#0B1F3A]">{exam.title}</h2>
              <div className="mt-3 text-xs text-slate-600 tabular-nums space-y-1">
                <div>Duration: {exam.durationMinutes} min · {exam.questionCount} questions</div>
                <div>Difficulty: {exam.difficulty} · Primary Skill: {exam.primarySkill}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onLaunchExam(exam.slug)}
              className="mt-5 w-full px-4 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#132D52] rounded-lg"
            >
              Launch Exam
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResourcesPublicPage({ resources }: { resources: StudyResource[] }) {
  const [skill, setSkill] = useState('ALL');
  const articles = resources.filter(
    (r) => (r.resourceType === 'Article' || r.resourceType === 'Guide') && (skill === 'ALL' || r.skill === skill)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0B1F3A]">Preparation Resources</h1>
          <p className="text-slate-600 mt-1">
            Methodological guides authored by assessment specialists across Listening, Reading, Writing, and Speaking.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          {['ALL', 'Reading', 'Writing', 'Speaking', 'Listening'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSkill(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                skill === s ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-slate-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((r) => (
          <article key={r.id} className="border border-slate-200 rounded-xl p-6 bg-white space-y-3">
            <div className="text-xs text-slate-500">
              {r.resourceType} · {r.examFamily.replace('_', ' ')} · {r.skill}
            </div>
            <h2 className="text-lg font-bold text-[#0B1F3A]">{r.title}</h2>
            <p className="text-sm font-medium text-slate-700">{r.summary}</p>
            <p className="text-sm text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
              {r.content}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function PricingPublicPage({
  plans,
  onSelectPlan,
}: {
  plans: SubscriptionPlan[];
  onSelectPlan: (code: string) => void;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-10">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-extrabold text-[#0B1F3A]">Transparent Packages &amp; Access Tiers</h1>
        <p className="text-slate-600">
          Begin with our complimentary diagnostic tier or unlock AI-assisted rubric evaluations and
          QR-verified PDF score reports.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((p) => {
          const discounted = Math.round((p.priceCents * (100 - p.discountPercent)) / 100) / 100;
          const isFeatured = p.code === 'PREMIUM';
          return (
            <div
              key={p.id}
              className={`rounded-xl p-6 flex flex-col justify-between border ${
                isFeatured ? 'border-[#1D4ED8] bg-[#F8FAFC]' : 'border-slate-200 bg-white'
              }`}
            >
              <div>
                <div className="text-xs font-semibold text-[#1D4ED8] uppercase tracking-wider">
                  {p.code}
                </div>
                <h2 className="text-xl font-bold text-[#0B1F3A] mt-1">{p.name}</h2>
                <p className="text-xs text-slate-600 mt-1.5 min-h-[2.5rem]">{p.description}</p>
                <div className="mt-4 pb-4 border-b border-slate-200 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#0B1F3A] tabular-nums">
                    ${discounted.toFixed(0)}
                  </span>
                  <span className="text-xs text-slate-500">
                    / {p.durationDays} days
                    {p.discountPercent > 0 ? ` (${p.discountPercent}% off)` : ''}
                  </span>
                </div>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                    <span className="tabular-nums">Up to {p.maxMonthlyAttempts} attempts / period</span>
                  </li>
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => onSelectPlan(p.code)}
                className={`mt-6 w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${
                  isFeatured
                    ? 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
                    : 'bg-[#0B1F3A] text-white hover:bg-[#132D52]'
                }`}
              >
                {p.priceCents === 0 ? 'Start Free Account' : `Select ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AboutPublicPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <h1 className="text-3xl font-extrabold text-[#0B1F3A]">About Meridian Assessment</h1>
      <p className="text-base text-slate-700 leading-relaxed">
        Meridian Assessment is an independent international English language testing and preparation
        platform built for university applicants, skilled professionals, and language academies. Our
        engine combines realistic timed computer-delivered mock sittings with transparent rubric-based
        evaluations and examiner moderation.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="text-lg font-bold text-[#0B1F3A]">Assessment Integrity</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every mock sitting enforces server-validated countdowns, encrypted answer autosave, and
            role-separated examiner review workflows with documented audit trails.
          </p>
        </div>
        <div className="border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="text-lg font-bold text-[#0B1F3A]">Independent Practice Notice</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Meridian Assessment is an independent preparation platform and is not affiliated with
            British Council, IDP, Cambridge English, Pearson VUE, or ETS.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ContactPublicPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setFeedback('');
    try {
      const res = await apiFetch<{ message: string }>('/api/contact', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setStatus('success');
      setFeedback(res.message);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setStatus('error');
      setFeedback(err instanceof Error ? err.message : 'Unable to send message.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-[#0B1F3A]">Contact Academic Support</h1>
        <p className="text-slate-600 mt-2">
          Questions regarding institutional cohorts, technical troubleshooting, or report verification.
        </p>
      </div>

      {status === 'success' && (
        <div className="border border-emerald-200 bg-emerald-50 text-emerald-900 rounded-xl p-4 flex items-start gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <span>{feedback}</span>
        </div>
      )}
      {status === 'error' && (
        <div className="border border-red-200 bg-red-50 text-red-900 rounded-xl p-4 text-sm">
          {feedback}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-6 sm:p-8 bg-white space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700 mb-1.5">
              Full Name
            </label>
            <input
              id="contact-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />
          </div>
          <div>
            <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Email Address
            </label>
            <input
              id="contact-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />
          </div>
        </div>
        <div>
          <label htmlFor="contact-subject" className="block text-sm font-medium text-slate-700 mb-1.5">
            Subject
          </label>
          <input
            id="contact-subject"
            type="text"
            required
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
          />
        </div>
        <div>
          <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700 mb-1.5">
            Message
          </label>
          <textarea
            id="contact-message"
            rows={5}
            required
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg disabled:opacity-60"
        >
          {status === 'submitting' ? 'Sending...' : 'Submit Inquiry'}
        </button>
      </form>
    </div>
  );
}

export function LegalPage({ type }: { type: 'privacy' | 'terms' }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-6">
      <h1 className="text-3xl font-extrabold text-[#0B1F3A]">
        {type === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions'}
      </h1>
      {type === 'privacy' ? (
        <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
          <p>
            Meridian Assessment collects only the personal and academic details necessary to deliver
            timed language assessments, generate performance tracking, and issue verifiable
            unofficial practice reports. We do not collect government identity documents or passwords
            for third-party services.
          </p>
          <p>
            Written responses and speaking audio recordings are stored securely on the server,
            accessible strictly to the authenticated candidate and authorized academic examiners.
            Candidates may permanently delete their account and associated records from Profile &amp;
            Subscriptions at any time.
          </p>
        </div>
      ) : (
        <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
          <p>
            All practice tests, estimated band scores, CEFR levels, and downloadable PDF reports
            provided by Meridian Assessment are independent, unofficial diagnostic records intended
            solely for educational preparation and institutional placement.
          </p>
          <p>
            Paid subscriptions unlock only upon verified provider payment confirmation. Automated
            AI feedback is supplementary; results may be reviewed or invalidated by administrators
            where academic integrity issues occur.
          </p>
        </div>
      )}
    </div>
  );
}

interface VerifiedReportPayload {
  verified: boolean;
  reportRef: string;
  verificationCode: string;
  candidateRef: string;
  candidateInitialsName: string;
  examTitle: string;
  examDate: string;
  overallLabel: string;
  cefrLevel: string;
  status: string;
  verifiedCount: number;
  disclaimer: string;
  skillScores: Array<{ skill: string; label: string }>;
}

export function VerifyReportPage({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode || 'MRD-2026-00419');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<VerifiedReportPayload | null>(null);

  const runLookup = async (targetCode: string) => {
    const clean = targetCode.trim();
    if (!clean) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<VerifiedReportPayload>(
        `/api/verify/${encodeURIComponent(clean)}`
      );
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      void runLookup(initialCode);
    }
  }, [initialCode]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-[#0B1F3A]">Result Report Verification</h1>
        <p className="text-slate-600">
          Enter the verification code printed on a Meridian Assessment PDF report (for example,{' '}
          <span className="font-mono-tabular font-semibold">MRD-2026-00419</span>).
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runLookup(code);
        }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="MRD-2026-00419"
          aria-label="Verification code"
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg font-mono-tabular text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#132D52] rounded-lg"
        >
          <Search className="w-4 h-4" />
          <span>{loading ? 'Verifying...' : 'Verify Report'}</span>
        </button>
      </form>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-900 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          <div className="bg-[#0B1F3A] text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              <span className="font-bold">
                {result.verified ? 'Verified Unofficial Practice Record' : 'Report Invalidated'}
              </span>
            </div>
            <span className="font-mono-tabular text-xs text-slate-300">
              Checks: {result.verifiedCount}
            </span>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">Candidate</div>
                <div className="font-semibold text-[#0B1F3A]">
                  {result.candidateInitialsName} ({result.candidateRef})
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Report Reference</div>
                <div className="font-mono-tabular font-semibold text-[#0B1F3A]">
                  {result.reportRef}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Examination</div>
                <div className="font-semibold text-[#0B1F3A]">{result.examTitle}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Overall Estimated Score</div>
                <div className="font-bold text-[#1D4ED8] text-lg tabular-nums">
                  {result.overallLabel} · CEFR {result.cefrLevel}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
              {result.skillScores.map((s) => (
                <div key={s.skill} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-xs text-slate-500">{s.skill}</div>
                  <div className="text-sm font-bold text-[#0B1F3A] tabular-nums mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <FileText className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>{result.disclaimer}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
