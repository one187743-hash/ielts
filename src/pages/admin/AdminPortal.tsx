import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileEdit,
  LogOut,
  Plus,
  Shield,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch, setAuthToken } from '../../lib/api';
import { MeridianLogoMark } from '../../components/BrandMark';
import type { AccessTier, ExamFamily, SkillName, SubscriptionPlan, UserSession } from '../../lib/types';

export function AdminPortal({
  user,
  onAuthSuccess,
  onLogout,
  onNavigate,
}: {
  user: UserSession | null;
  onAuthSuccess: (u: UserSession) => void;
  onLogout: () => void;
  onNavigate: (path: string) => void;
}) {
  const [bootstrap, setBootstrap] = useState<{
    needsSetup: boolean;
    envPasscodeConfigured: boolean;
  } | null>(null);

  // Auth form states
  const [claimForm, setClaimForm] = useState({ fullName: '', email: '', password: '' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '', passcode: '' });
  const [authError, setAuthError] = useState('');

  // Admin workspace states
  const [tab, setTab] = useState<
    'overview' | 'students' | 'exams' | 'assessments' | 'business' | 'content'
  >('overview');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [overview, setOverview] = useState<{
    kpis: {
      totalStudents: number;
      totalExams: number;
      totalAttempts: number;
      pendingReviews: number;
      revenueUsd: number;
    };
    examsByFamily: Array<{ name: string; attempts: number }>;
    auditLogs: Array<{
      id: number;
      actor_role: string;
      action: string;
      target_type: string;
      target_id: string;
      reason: string | null;
      created_at: string;
    }>;
  } | null>(null);

  const [students, setStudents] = useState<Array<Record<string, unknown>>>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [exams, setExams] = useState<Array<Record<string, unknown>>>([]);
  const [submissions, setSubmissions] = useState<Array<Record<string, unknown>>>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<{
    attemptId: number;
    resultId: number;
    answers: Array<Record<string, unknown>>;
    report: Record<string, unknown> | null;
  } | null>(null);
  const [reviewForm, setReviewForm] = useState({
    status: 'reviewed' as 'completed' | 'reviewed' | 'invalidated',
    reason: '',
    writingOverride: '',
    speakingOverride: '',
  });

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [contentData, setContentData] = useState<{
    resources: Array<Record<string, unknown>>;
    supportRequests: Array<Record<string, unknown>>;
  }>({ resources: [], supportRequests: [] });

  // New exam form
  const [newExam, setNewExam] = useState({
    title: '',
    examFamily: 'IELTS_ACADEMIC' as ExamFamily,
    category: 'Skill Practice' as 'Full Mock' | 'Mini Mock' | 'Skill Practice',
    primarySkill: 'Reading' as 'All' | SkillName,
    difficulty: 'Intermediate' as 'Foundation' | 'Intermediate' | 'Advanced',
    durationMinutes: 30,
    accessTier: 'FREE' as AccessTier,
    sectionTitle: 'Section 1: Academic Practice',
    sectionSkill: 'Reading' as SkillName,
    instructions: 'Complete all questions within the allocated timer.',
  });

  // Quick question form
  const [newQuestion, setNewQuestion] = useState({
    examId: 0,
    questionType: 'mcq',
    prompt: '',
    maxMarks: 1,
    correctAnswer: 'A',
    optA: '',
    optB: '',
    optC: '',
  });

  // New CMS content form
  const [newContent, setNewContent] = useState({
    title: '',
    examFamily: 'ALL',
    skill: 'General',
    resourceType: 'Article' as 'Article' | 'Guide' | 'FAQ' | 'Banner',
    summary: '',
    content: '',
  });

  useEffect(() => {
    void apiFetch<{ needsSetup: boolean; envPasscodeConfigured: boolean }>(
      '/api/admin/bootstrap-status'
    ).then(setBootstrap);
  }, []);

  const loadAdminData = async () => {
    if (!user || user.role !== 'admin') return;
    setErrorMsg('');
    try {
      const [ov, st, ex, sub, pl, pay, cnt] = await Promise.all([
        apiFetch<typeof overview>('/api/admin/overview'),
        apiFetch<{ students: Array<Record<string, unknown>> }>(
          `/api/admin/students?q=${encodeURIComponent(studentQuery)}`
        ),
        apiFetch<{ exams: Array<Record<string, unknown>> }>('/api/admin/exams'),
        apiFetch<{ submissions: Array<Record<string, unknown>> }>('/api/admin/submissions'),
        apiFetch<{ plans: SubscriptionPlan[] }>('/api/plans'),
        apiFetch<{ payments: Array<Record<string, unknown>> }>('/api/admin/payments'),
        apiFetch<typeof contentData>('/api/admin/content'),
      ]);
      setOverview(ov);
      setStudents(st.students);
      setExams(ex.exams);
      setSubmissions(sub.submissions);
      setPlans(pl.plans);
      setPayments(pay.payments);
      setContentData(cnt);
      if (ex.exams.length > 0 && newQuestion.examId === 0) {
        setNewQuestion((prev) => ({ ...prev, examId: Number(ex.exams[0].id) }));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load administrator data.');
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, [user, tab]);

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await apiFetch<{ token: string; user: UserSession }>('/api/admin/claim', {
        method: 'POST',
        body: JSON.stringify(claimForm),
      });
      setAuthToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to claim administrator access.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await apiFetch<{ token: string; user: UserSession }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });
      setAuthToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Administrator sign in failed.');
    }
  };

  // Gate when not signed in as admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MeridianLogoMark className="w-7 h-7" />
              <span className="font-bold text-[#0B1F3A] font-display">
                Meridian Admin Console
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-xs text-[#1D4ED8] hover:underline"
            >
              Public Site
            </button>
          </div>

          {user && user.role !== 'admin' && (
            <div className="border border-amber-200 bg-amber-50 text-amber-900 rounded-lg p-3 text-xs">
              You are currently signed in as a student ({user.email}). Sign in with administrator
              credentials below to switch roles.
            </div>
          )}

          {authError && (
            <div className="border border-red-200 bg-red-50 text-red-900 rounded-lg p-3 text-xs">
              {authError}
            </div>
          )}

          {bootstrap?.needsSetup ? (
            <form onSubmit={handleClaimAdmin} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-950">
                First-run setup: claim the initial Administrator account. Once created, this
                one-time registration route locks automatically.
              </div>
              <div>
                <label htmlFor="adm-c-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Administrator Full Name
                </label>
                <input
                  id="adm-c-name"
                  type="text"
                  required
                  value={claimForm.fullName}
                  onChange={(e) => setClaimForm({ ...claimForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label htmlFor="adm-c-email" className="block text-xs font-medium text-slate-700 mb-1">
                  Administrator Email
                </label>
                <input
                  id="adm-c-email"
                  type="email"
                  required
                  value={claimForm.email}
                  onChange={(e) => setClaimForm({ ...claimForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label htmlFor="adm-c-pass" className="block text-xs font-medium text-slate-700 mb-1">
                  Password (8+ characters)
                </label>
                <input
                  id="adm-c-pass"
                  type="password"
                  required
                  minLength={8}
                  value={claimForm.password}
                  onChange={(e) => setClaimForm({ ...claimForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#132D52] rounded-lg"
              >
                Create &amp; Claim Administrator Account
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              {bootstrap?.envPasscodeConfigured ? (
                <div>
                  <label htmlFor="adm-passcode" className="block text-xs font-medium text-slate-700 mb-1">
                    Administrator Passcode
                  </label>
                  <input
                    id="adm-passcode"
                    type="password"
                    required
                    value={loginForm.passcode}
                    onChange={(e) => setLoginForm({ ...loginForm, passcode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="adm-email" className="block text-xs font-medium text-slate-700 mb-1">
                      Administrator Email
                    </label>
                    <input
                      id="adm-email"
                      type="email"
                      required
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adm-pass" className="block text-xs font-medium text-slate-700 mb-1">
                      Password
                    </label>
                    <input
                      id="adm-pass"
                      type="password"
                      required
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </>
              )}
              <button
                type="submit"
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#132D52] rounded-lg"
              >
                Sign In to Admin Portal
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('');
    try {
      await apiFetch('/api/admin/exams', {
        method: 'POST',
        body: JSON.stringify(newExam),
      });
      setStatusMsg('Examination template created.');
      setNewExam((prev) => ({ ...prev, title: '' }));
      await loadAdminData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create exam.');
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.examId) return;
    try {
      await apiFetch(`/api/admin/exams/${newQuestion.examId}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          questionType: newQuestion.questionType,
          prompt: newQuestion.prompt,
          maxMarks: Number(newQuestion.maxMarks),
          correctAnswer: newQuestion.correctAnswer,
          options:
            newQuestion.questionType === 'mcq'
              ? [
                  { key: 'A', text: newQuestion.optA || 'Option A', isCorrect: newQuestion.correctAnswer === 'A' },
                  { key: 'B', text: newQuestion.optB || 'Option B', isCorrect: newQuestion.correctAnswer === 'B' },
                  { key: 'C', text: newQuestion.optC || 'Option C', isCorrect: newQuestion.correctAnswer === 'C' },
                ]
              : undefined,
        }),
      });
      setStatusMsg('Question added to examination.');
      setNewQuestion((prev) => ({ ...prev, prompt: '', optA: '', optB: '', optC: '' }));
      await loadAdminData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add question.');
    }
  };

  const handleInspectSubmission = async (attemptId: number, resultId: number) => {
    const res = await apiFetch<{
      answers: Array<Record<string, unknown>>;
      report: Record<string, unknown> | null;
    }>(`/api/admin/submissions/${attemptId}`);
    setSelectedAttempt({ attemptId, resultId, answers: res.answers, report: res.report });
  };

  const handleSubmitModeration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttempt) return;
    const skillOverrides: Array<{ skill: SkillName; score: number }> = [];
    if (reviewForm.writingOverride.trim() !== '') {
      skillOverrides.push({ skill: 'Writing', score: Number(reviewForm.writingOverride) });
    }
    if (reviewForm.speakingOverride.trim() !== '') {
      skillOverrides.push({ skill: 'Speaking', score: Number(reviewForm.speakingOverride) });
    }

    await apiFetch(`/api/admin/results/${selectedAttempt.resultId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: reviewForm.status,
        reason: reviewForm.reason,
        skillOverrides: skillOverrides.length > 0 ? skillOverrides : undefined,
      }),
    });
    setStatusMsg('Result moderated and audit log recorded.');
    setSelectedAttempt(null);
    setReviewForm({ status: 'reviewed', reason: '', writingOverride: '', speakingOverride: '' });
    await loadAdminData();
  };

  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/content', {
      method: 'POST',
      body: JSON.stringify(newContent),
    });
    setStatusMsg('CMS content item published.');
    setNewContent({
      title: '',
      examFamily: 'ALL',
      skill: 'General',
      resourceType: 'Article',
      summary: '',
      content: '',
    });
    await loadAdminData();
  };

  const navTabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'exams', label: 'Examinations', icon: BookOpen },
    { id: 'assessments', label: 'Assessments', icon: ClipboardCheck },
    { id: 'business', label: 'Plans & Payments', icon: CreditCard },
    { id: 'content', label: 'Content & Support', icon: FileEdit },
  ] as const;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      <aside className="w-full lg:w-64 bg-[#0B1F3A] text-slate-200 flex flex-col justify-between shrink-0">
        <div>
          <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-sm font-display">
              <Shield className="w-5 h-5 text-blue-300" />
              <span>Admin Governance</span>
            </div>
          </div>
          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {navTabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                    tab === t.id
                      ? 'bg-[#1D4ED8] text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800 flex lg:flex-col gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xs text-left text-slate-300 hover:text-white px-2 py-1"
          >
            View Public Site
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-300 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out ({user.email})</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto space-y-6">
        {statusMsg && (
          <div className="border border-emerald-200 bg-emerald-50 text-emerald-900 rounded-xl p-3.5 flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="border border-red-200 bg-red-50 text-red-900 rounded-xl p-3.5 text-xs">
            {errorMsg}
          </div>
        )}

        {/* 1. OVERVIEW */}
        {tab === 'overview' && overview && (
          <div className="space-y-6">
            <h1 className="text-2xl font-extrabold text-[#0B1F3A]">Administrator Overview</h1>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Students', val: overview.kpis.totalStudents },
                { label: 'Examinations', val: overview.kpis.totalExams },
                { label: 'Total Attempts', val: overview.kpis.totalAttempts },
                { label: 'Pending Reviews', val: overview.kpis.pendingReviews },
                { label: 'Verified Revenue', val: `$${overview.kpis.revenueUsd.toFixed(2)}` },
              ].map((k) => (
                <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">{k.label}</div>
                  <div className="text-2xl font-extrabold text-[#0B1F3A] tabular-nums mt-1">
                    {k.val}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="text-base font-bold text-[#0B1F3A]">Attempts by Exam Family</h2>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.examsByFamily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="attempts" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="text-base font-bold text-[#0B1F3A]">Recent Audit Trail</h2>
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto text-xs">
                  {overview.auditLogs.map((log) => (
                    <div key={log.id} className="py-2 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono-tabular font-bold text-[#0B1F3A]">
                          {log.action}
                        </span>{' '}
                        <span className="text-slate-600">
                          ({log.target_type} #{log.target_id})
                        </span>
                        {log.reason && <div className="text-slate-500">{log.reason}</div>}
                      </div>
                      <span className="text-slate-400 tabular-nums shrink-0">
                        {String(log.created_at).slice(0, 10)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. STUDENTS */}
        {tab === 'students' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-extrabold text-[#0B1F3A]">Student Directory</h1>
              <div className="flex gap-2">
                <input
                  type="search"
                  placeholder="Search name or email..."
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={() => void loadAdminData()}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#0B1F3A] text-white rounded-lg"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Candidate</th>
                    <th className="py-2 pr-3">Country</th>
                    <th className="py-2 pr-3">Track / Target</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Attempts</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((st) => (
                    <tr key={Number(st.id)}>
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-[#0B1F3A]">{String(st.full_name || '—')}</div>
                        <div className="text-slate-500">{String(st.email)}</div>
                      </td>
                      <td className="py-2.5 pr-3">{String(st.country || '—')}</td>
                      <td className="py-2.5 pr-3">
                        {String(st.preferred_exam || '—')} ({String(st.target_score || '—')})
                      </td>
                      <td className="py-2.5 pr-3 font-semibold">{String(st.plan_code || 'FREE')}</td>
                      <td className="py-2.5 pr-3 tabular-nums">{String(st.attempts_count)}</td>
                      <td className="py-2.5 pr-3 capitalize">{String(st.status)}</td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            const next = st.status === 'active' ? 'suspended' : 'active';
                            await apiFetch(`/api/admin/students/${st.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: next }),
                            });
                            await loadAdminData();
                          }}
                          className="px-2.5 py-1 border border-slate-300 rounded text-slate-700 hover:bg-slate-50"
                        >
                          {st.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. EXAMINATIONS */}
        {tab === 'exams' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h1 className="text-xl font-extrabold text-[#0B1F3A]">Examination Templates</h1>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Title</th>
                      <th className="py-2 pr-3">Family</th>
                      <th className="py-2 pr-3">Tier</th>
                      <th className="py-2 pr-3">Duration</th>
                      <th className="py-2 pr-3">Questions</th>
                      <th className="py-2 pr-3">Published</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exams.map((ex) => (
                      <tr key={Number(ex.id)}>
                        <td className="py-2.5 pr-3 font-semibold text-[#0B1F3A]">{String(ex.title)}</td>
                        <td className="py-2.5 pr-3">{String(ex.exam_family)}</td>
                        <td className="py-2.5 pr-3">{String(ex.access_tier)}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{String(ex.duration_minutes)} min</td>
                        <td className="py-2.5 pr-3 tabular-nums">{String(ex.question_count)}</td>
                        <td className="py-2.5 pr-3">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/admin/exams/${ex.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ published: !Boolean(ex.published) }),
                              });
                              await loadAdminData();
                            }}
                            className="px-2.5 py-1 border border-slate-300 rounded text-xs"
                          >
                            {ex.published ? 'Published' : 'Hidden'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form
                onSubmit={handleCreateExam}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Create Examination Template</span>
                </h2>
                <input
                  type="text"
                  required
                  placeholder="Examination Title"
                  value={newExam.title}
                  onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={newExam.examFamily}
                    onChange={(e) =>
                      setNewExam({ ...newExam, examFamily: e.target.value as ExamFamily })
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="IELTS_ACADEMIC">IELTS Academic</option>
                    <option value="IELTS_GENERAL">IELTS General</option>
                    <option value="PTE_ACADEMIC">PTE Academic</option>
                    <option value="TOEFL_IBT">TOEFL iBT</option>
                    <option value="GENERAL_ENGLISH">General English</option>
                  </select>
                  <select
                    value={newExam.accessTier}
                    onChange={(e) =>
                      setNewExam({ ...newExam, accessTier: e.target.value as AccessTier })
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="FREE">FREE</option>
                    <option value="BASIC">BASIC</option>
                    <option value="PREMIUM">PREMIUM</option>
                  </select>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={newExam.durationMinutes}
                    onChange={(e) =>
                      setNewExam({ ...newExam, durationMinutes: Number(e.target.value) })
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <select
                    value={newExam.sectionSkill}
                    onChange={(e) =>
                      setNewExam({
                        ...newExam,
                        sectionSkill: e.target.value as SkillName,
                        primarySkill: e.target.value as SkillName,
                      })
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Reading">Reading</option>
                    <option value="Listening">Listening</option>
                    <option value="Writing">Writing</option>
                    <option value="Speaking">Speaking</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg"
                >
                  Create Examination
                </button>
              </form>

              <form
                onSubmit={handleAddQuestion}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="text-base font-bold text-[#0B1F3A]">Add Question to Bank</h2>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={newQuestion.examId}
                    onChange={(e) =>
                      setNewQuestion({ ...newQuestion, examId: Number(e.target.value) })
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    {exams.map((ex) => (
                      <option key={Number(ex.id)} value={Number(ex.id)}>
                        {String(ex.title)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newQuestion.questionType}
                    onChange={(e) =>
                      setNewQuestion({ ...newQuestion, questionType: e.target.value })
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="completion">Sentence Completion</option>
                    <option value="writing_task2">Writing Task</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  required
                  placeholder="Question prompt..."
                  value={newQuestion.prompt}
                  onChange={(e) => setNewQuestion({ ...newQuestion, prompt: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
                {newQuestion.questionType === 'mcq' && (
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Option A"
                      value={newQuestion.optA}
                      onChange={(e) => setNewQuestion({ ...newQuestion, optA: e.target.value })}
                      className="px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Option B"
                      value={newQuestion.optB}
                      onChange={(e) => setNewQuestion({ ...newQuestion, optB: e.target.value })}
                      className="px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Option C"
                      value={newQuestion.optC}
                      onChange={(e) => setNewQuestion({ ...newQuestion, optC: e.target.value })}
                      className="px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                    />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Correct answer key/text"
                    value={newQuestion.correctAnswer}
                    onChange={(e) =>
                      setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })
                    }
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0B1F3A] rounded-lg"
                  >
                    Add Question
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4. ASSESSMENTS & MODERATION */}
        {tab === 'assessments' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h1 className="text-xl font-extrabold text-[#0B1F3A]">
                Assessment Submissions &amp; Moderation Queue
              </h1>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Candidate</th>
                      <th className="py-2 pr-3">Examination</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Score</th>
                      <th className="py-2 text-right">Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissions.map((s) => (
                      <tr key={Number(s.attempt_id)}>
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold text-[#0B1F3A]">
                            {String(s.student_name || s.student_email)}
                          </div>
                          <div className="text-slate-500">{String(s.report_ref || '—')}</div>
                        </td>
                        <td className="py-2.5 pr-3">{String(s.exam_title)}</td>
                        <td className="py-2.5 pr-3 capitalize">{String(s.result_status || s.attempt_status)}</td>
                        <td className="py-2.5 pr-3 font-bold text-[#1D4ED8] tabular-nums">
                          {String(s.overall_label || 'Pending')}
                        </td>
                        <td className="py-2.5 text-right">
                          {s.result_id ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleInspectSubmission(
                                  Number(s.attempt_id),
                                  Number(s.result_id)
                                )
                              }
                              className="px-3 py-1 text-xs font-semibold text-white bg-[#0B1F3A] rounded-lg"
                            >
                              Moderate
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedAttempt && (
              <form
                onSubmit={handleSubmitModeration}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#0B1F3A]">
                    Examiner Review — Attempt #{selectedAttempt.attemptId}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedAttempt(null)}
                    className="text-xs text-slate-500"
                  >
                    Close
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs">
                  {selectedAttempt.answers.map((a, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded p-2.5">
                      <div className="font-semibold text-[#0B1F3A]">
                        [{String(a.skill)}] {String(a.prompt)}
                      </div>
                      <div className="text-slate-700 mt-1">
                        Response: {String(a.selected_option_key || a.answer_text || '(empty)')}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Result Status
                    </label>
                    <select
                      value={reviewForm.status}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          status: e.target.value as 'completed' | 'reviewed' | 'invalidated',
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="reviewed">Reviewed &amp; Published</option>
                      <option value="completed">Completed</option>
                      <option value="invalidated">Invalidated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Writing Score Override (Optional)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={reviewForm.writingOverride}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, writingOverride: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Speaking Score Override (Optional)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={reviewForm.speakingOverride}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, speakingOverride: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Documented Moderation Reason (Required for Audit Log)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    value={reviewForm.reason}
                    onChange={(e) => setReviewForm({ ...reviewForm, reason: e.target.value })}
                    placeholder="e.g., Examiner verified Writing Task 2 coherence and adjusted band."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg"
                >
                  Save Moderation &amp; Publish Result
                </button>
              </form>
            )}
          </div>
        )}

        {/* 5. BUSINESS & PLANS */}
        {tab === 'business' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h1 className="text-xl font-extrabold text-[#0B1F3A]">Subscription Plans</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((p) => (
                  <div key={p.id} className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                    <div className="font-bold text-[#0B1F3A]">{p.name} ({p.code})</div>
                    <div className="tabular-nums">
                      Price: ${(p.priceCents / 100).toFixed(2)} · Discount: {p.discountPercent}%
                    </div>
                    <div className="tabular-nums">Monthly Limit: {p.maxMonthlyAttempts}</div>
                    <div>AI Assessment: {p.aiAssessmentEnabled ? 'Enabled' : 'Disabled'}</div>
                    {p.code !== 'FREE' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/plans/${p.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              discountPercent: p.discountPercent === 0 ? 15 : 0,
                            }),
                          });
                          setStatusMsg(`Updated discount on ${p.code}.`);
                          await loadAdminData();
                        }}
                        className="mt-2 px-2.5 py-1 border border-slate-300 rounded text-slate-700"
                      >
                        Toggle 15% Discount
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-[#0B1F3A]">Payment Records</h2>
              {payments.length === 0 ? (
                <p className="text-xs text-slate-500">No payment transactions recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 pr-3">Reference</th>
                        <th className="py-2 pr-3">Student</th>
                        <th className="py-2 pr-3">Plan</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Webhook Verified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((pay) => (
                        <tr key={Number(pay.id)}>
                          <td className="py-2 pr-3 font-mono-tabular">{String(pay.provider_ref)}</td>
                          <td className="py-2 pr-3">{String(pay.user_email)}</td>
                          <td className="py-2 pr-3">{String(pay.plan_code)}</td>
                          <td className="py-2 pr-3 tabular-nums">
                            ${(Number(pay.amount_cents) / 100).toFixed(2)}
                          </td>
                          <td className="py-2 pr-3 capitalize">{String(pay.status)}</td>
                          <td className="py-2">{pay.webhook_verified ? 'Yes' : 'Pending'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. CONTENT & SUPPORT */}
        {tab === 'content' && (
          <div className="space-y-6">
            <form
              onSubmit={handleCreateContent}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h1 className="text-xl font-extrabold text-[#0B1F3A]">
                Publish Banner, FAQ, or Preparation Guide
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Title"
                  value={newContent.title}
                  onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
                <select
                  value={newContent.resourceType}
                  onChange={(e) =>
                    setNewContent({
                      ...newContent,
                      resourceType: e.target.value as 'Article' | 'Guide' | 'FAQ' | 'Banner',
                    })
                  }
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="Article">Article</option>
                  <option value="Guide">Study Guide</option>
                  <option value="FAQ">FAQ</option>
                  <option value="Banner">Website Banner</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Short summary"
                  value={newContent.summary}
                  onChange={(e) => setNewContent({ ...newContent, summary: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <textarea
                rows={3}
                required
                placeholder="Full content body..."
                value={newContent.content}
                onChange={(e) => setNewContent({ ...newContent, content: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg"
              >
                Publish Item
              </button>
            </form>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="text-base font-bold text-[#0B1F3A]">Published CMS Items</h2>
              <div className="divide-y divide-slate-100 text-xs">
                {contentData.resources.map((r) => (
                  <div key={Number(r.id)} className="py-2.5 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold text-[#0B1F3A]">[{String(r.resource_type)}] {String(r.title)}</span>
                      <div className="text-slate-500">{String(r.summary)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/content/${r.id}`, { method: 'DELETE' });
                        await loadAdminData();
                      }}
                      className="text-red-600 hover:underline shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="text-base font-bold text-[#0B1F3A]">Support Inquiries</h2>
              {contentData.supportRequests.length === 0 ? (
                <p className="text-xs text-slate-500">No support requests submitted.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {contentData.supportRequests.map((sr) => (
                    <div key={Number(sr.id)} className="py-2.5">
                      <div className="font-semibold text-[#0B1F3A]">
                        {String(sr.subject)} — {String(sr.name)} ({String(sr.email)})
                      </div>
                      <p className="text-slate-600 mt-0.5">{String(sr.message)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
