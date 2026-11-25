import React, { useEffect, useState } from 'react';
import {
  Award,
  Bell,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileText,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  PenTool,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../../lib/api';
import { MeridianLogoMark } from '../../components/BrandMark';
import type {
  AccessTier,
  ExamFamily,
  ExamSummary,
  SkillName,
  StudentProfile,
  SubscriptionPlan,
  UserSession,
} from '../../lib/types';

interface DashboardPayload {
  profile: {
    fullName: string;
    preferredExam: ExamFamily;
    targetScore: string;
    intendedExamDate: string | null;
    objective: string;
    country: string;
  };
  plan: {
    code: AccessTier;
    name: string;
    attempts_used: number;
    max_monthly_attempts: number;
    ai_assessment_enabled: number;
    pdf_reports_enabled: number;
    expires_at: string | null;
  };
  stats: {
    totalAttempts: number;
    completedReports: number;
    averageOverall: number | null;
    skillAverages: Record<SkillName, { avgScore: number | null; maxScore: number; count: number }>;
  };
  history: Array<Record<string, unknown>>;
  recentReports: Array<{
    report_id: number;
    report_ref: string;
    verification_code: string;
    status: string;
    generated_at: string;
    overall_label: string;
    cefr_level: string;
    exam_title: string;
    attempt_number: number;
  }>;
  weaknesses: string[];
  recommendations: string[];
  recommendedExams: Array<{
    id: number;
    slug: string;
    title: string;
    exam_family: ExamFamily;
    category: string;
    duration_minutes: number;
    access_tier: AccessTier;
  }>;
  notifications: Array<{
    id: number;
    title: string;
    message: string;
    category: string;
    is_read: number;
    created_at: string;
  }>;
}

const TIER_RANK: Record<AccessTier, number> = {
  FREE: 0,
  BASIC: 1,
  PREMIUM: 2,
  INSTITUTIONAL: 3,
};

export function StudentPortal({
  user,
  activeTab,
  onNavigate,
  onStartExam,
  onLogout,
}: {
  user: UserSession;
  activeTab: 'overview' | 'exams' | 'reports' | 'profile';
  onNavigate: (path: string) => void;
  onStartExam: (slug: string) => void;
  onLogout: () => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Exam library filters
  const [familyFilter, setFamilyFilter] = useState('ALL');
  const [skillFilter, setSkillFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [attemptFilter, setAttemptFilter] = useState('ALL');

  // Profile & billing state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    country: '',
    city: '',
    educationLevel: 'Postgraduate',
    preferredExam: 'IELTS_ACADEMIC' as ExamFamily,
    targetScore: '7.5',
    intendedExamDate: '',
    objective: '',
  });
  const [profileMsg, setProfileMsg] = useState('');
  const [pendingPayment, setPendingPayment] = useState<{
    providerRef: string;
    amountCents: number;
    paymentMode: string;
    planCode: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const loadPortalData = async () => {
    setLoading(true);
    setError('');
    try {
      const [dRes, eRes, pRes, plansRes] = await Promise.all([
        apiFetch<DashboardPayload>('/api/student/dashboard'),
        apiFetch<{ exams: ExamSummary[] }>('/api/exams'),
        apiFetch<StudentProfile>('/api/student/profile'),
        apiFetch<{ plans: SubscriptionPlan[] }>('/api/plans'),
      ]);
      setDash(dRes);
      setExams(eRes.exams);
      setProfile(pRes);
      setPlans(plansRes.plans);
      setProfileForm({
        fullName: pRes.fullName || '',
        phone: pRes.phone || '',
        country: pRes.country || '',
        city: pRes.city || '',
        educationLevel: pRes.educationLevel || 'Undergraduate',
        preferredExam: pRes.preferredExam || 'IELTS_ACADEMIC',
        targetScore: pRes.targetScore || '7.5',
        intendedExamDate: pRes.intendedExamDate || '',
        objective: pRes.objective || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load portal data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPortalData();
  }, [activeTab]);

  const handleMarkRead = async (id: number) => {
    await apiFetch(`/api/student/notifications/${id}/read`, { method: 'POST' });
    setDash((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) =>
              n.id === id ? { ...n, is_read: 1 } : n
            ),
          }
        : null
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    try {
      await apiFetch('/api/student/profile', {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      });
      setProfileMsg('Profile updated.');
      await loadPortalData();
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleStartCheckout = async (planCode: 'BASIC' | 'PREMIUM' | 'INSTITUTIONAL') => {
    setError('');
    try {
      const res = await apiFetch<{
        providerRef: string;
        amountCents: number;
        paymentMode: string;
      }>('/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ planCode }),
      });
      setPendingPayment({ ...res, planCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout unavailable.');
    }
  };

  const handleSandboxVerifyWebhook = async () => {
    if (!pendingPayment) return;
    try {
      await apiFetch(`/api/payments/sandbox-confirm/${pendingPayment.providerRef}`, {
        method: 'POST',
      });
      setPendingPayment(null);
      setProfileMsg('Payment verified via webhook and subscription activated.');
      await loadPortalData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Webhook verification failed.');
    }
  };

  const handleDeleteAccount = async () => {
    await apiFetch('/api/account', { method: 'DELETE' });
    onLogout();
  };

  const filteredExams = exams.filter((e) => {
    if (familyFilter !== 'ALL' && e.examFamily !== familyFilter) return false;
    if (skillFilter !== 'ALL' && e.primarySkill !== skillFilter) return false;
    if (tierFilter !== 'ALL' && e.accessTier !== tierFilter) return false;
    if (attemptFilter === 'ATTEMPTED' && e.attemptedCount === 0) return false;
    if (attemptFilter === 'UNATTEMPTED' && e.attemptedCount > 0) return false;
    return true;
  });

  const navItems = [
    { id: 'overview', label: 'Dashboard', path: '/portal', icon: LayoutDashboard },
    { id: 'exams', label: 'Examination Library', path: '/portal/exams', icon: BookOpen },
    { id: 'reports', label: 'Results & Reports', path: '/portal/reports', icon: FileText },
    { id: 'profile', label: 'Profile & Billing', path: '/portal/profile', icon: User },
  ] as const;

  const skillMeta: Array<{ skill: SkillName; icon: typeof Headphones }> = [
    { skill: 'Listening', icon: Headphones },
    { skill: 'Reading', icon: BookOpen },
    { skill: 'Writing', icon: PenTool },
    { skill: 'Speaking', icon: Mic },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0B1F3A] text-slate-200 flex flex-col justify-between transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="flex items-center gap-2.5 text-white font-bold text-base font-display"
            >
              <MeridianLogoMark className="w-6 h-6" />
              <span>Meridian Portal</span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-white"
              aria-label="Close portal menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-3 space-y-1" aria-label="Student Portal Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    onNavigate(item.path);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#1D4ED8] text-white'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="text-xs">
            <div className="font-semibold text-white truncate">{user.fullName}</div>
            <div className="text-slate-400 truncate">{user.planName}</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label="Open portal navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500">
              <span>Candidate Portal</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-[#0B1F3A]">
                {navItems.find((i) => i.id === activeTab)?.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/portal/exams')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg whitespace-nowrap shrink-0"
          >
            Start Practice Test
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto space-y-8">
          {error && (
            <div className="border border-red-200 bg-red-50 text-red-900 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}

          {loading && !dash ? (
            <div className="space-y-4">
              <div className="h-24 bg-slate-200/60 rounded-xl animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 bg-slate-200/60 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ) : null}

          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'overview' && dash && (
            <div className="space-y-8">
              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-[#0B1F3A]">
                    Welcome back, {dash.profile.fullName}
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Preferred Track: {dash.profile.preferredExam.replace('_', ' ')} · Target Score:{' '}
                    <span className="font-semibold text-[#0B1F3A]">{dash.profile.targetScore}</span> ·{' '}
                    Objective: {dash.profile.objective}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500 tabular-nums">
                  <div className="font-semibold text-[#0B1F3A]">{dash.plan.name}</div>
                  <div>
                    Attempts used: {dash.plan.attempts_used} / {dash.plan.max_monthly_attempts}
                  </div>
                </div>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs text-slate-500">Total Tests Attempted</div>
                  <div className="text-2xl font-extrabold text-[#0B1F3A] tabular-nums mt-1">
                    {dash.stats.totalAttempts}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs text-slate-500">Average Overall Performance</div>
                  <div className="text-2xl font-extrabold text-[#1D4ED8] tabular-nums mt-1">
                    {dash.stats.averageOverall !== null ? dash.stats.averageOverall : 'No results yet'}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs text-slate-500">Target Score Benchmark</div>
                  <div className="text-2xl font-extrabold text-[#0B1F3A] tabular-nums mt-1">
                    {dash.profile.targetScore}
                  </div>
                </div>
              </div>

              {/* 4 Individual Skill Performance Cards */}
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A] mb-3">
                  Skill-Wise Performance (Database Averages)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {skillMeta.map(({ skill, icon: Icon }) => {
                    const stat = dash.stats.skillAverages[skill];
                    return (
                      <div key={skill} className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="text-xs font-semibold uppercase tracking-wider">
                            {skill}
                          </span>
                          <Icon className="w-4 h-4 text-[#1D4ED8]" />
                        </div>
                        <div className="text-2xl font-extrabold text-[#0B1F3A] tabular-nums">
                          {stat.avgScore !== null ? stat.avgScore : '—'}
                          {stat.avgScore !== null && (
                            <span className="text-xs font-normal text-slate-500">
                              {' '}
                              / {stat.maxScore}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          {stat.count} assessed {stat.count === 1 ? 'sitting' : 'sittings'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart + Weakness Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="text-base font-bold text-[#0B1F3A]">Performance History</h2>
                  {dash.history.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-500">
                      Complete your first timed mock examination to plot your progression curve.
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dash.history}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey="overall"
                            name="Overall Score"
                            stroke="#1D4ED8"
                            fill="#DBEAFE"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="text-base font-bold text-[#0B1F3A]">
                    Weakness Analysis &amp; Recommendations
                  </h2>
                  {dash.weaknesses.length === 0 && dash.recommendations.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Submit a Writing or Speaking section to receive rubric-linked diagnostic feedback.
                    </p>
                  ) : (
                    <div className="space-y-4 text-sm">
                      {dash.weaknesses.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-amber-800 mb-1.5">
                            Priority Focus Areas
                          </div>
                          <ul className="space-y-1.5 text-slate-700 list-disc pl-4">
                            {dash.weaknesses.map((w) => (
                              <li key={w}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {dash.recommendations.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-[#1D4ED8] mb-1.5">
                            Recommended Study Actions
                          </div>
                          <ul className="space-y-1.5 text-slate-700 list-disc pl-4">
                            {dash.recommendations.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Results + Recommended Practice + Notifications */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-[#0B1F3A]">Recent Result Reports</h2>
                    <button
                      type="button"
                      onClick={() => onNavigate('/portal/reports')}
                      className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  {dash.recentReports.length === 0 ? (
                    <p className="text-sm text-slate-500">No submitted examinations yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {dash.recentReports.slice(0, 4).map((r) => (
                        <div key={r.report_id} className="py-3 flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-[#0B1F3A]">{r.exam_title}</div>
                            <div className="text-xs text-slate-500 font-mono-tabular">
                              {r.report_ref} · {r.status} · {String(r.generated_at).slice(0, 10)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm font-bold text-[#1D4ED8] tabular-nums">
                              {r.overall_label}
                            </span>
                            <button
                              type="button"
                              onClick={() => onNavigate(`/portal/reports/${r.report_id}`)}
                              className="px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#1D4ED8]" />
                    <h2 className="text-base font-bold text-[#0B1F3A]">Notifications</h2>
                  </div>
                  {dash.notifications.length === 0 ? (
                    <p className="text-sm text-slate-500">You are all caught up.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {dash.notifications.slice(0, 4).map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 rounded-lg border text-xs ${
                            n.is_read ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-[#0B1F3A]">{n.title}</span>
                            {!n.is_read && (
                              <button
                                type="button"
                                onClick={() => void handleMarkRead(n.id)}
                                className="text-[#1D4ED8] hover:underline shrink-0"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                          <p className="text-slate-600 mt-1">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXAMINATION LIBRARY */}
          {activeTab === 'exams' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-extrabold text-[#0B1F3A]">Examination Library</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Select a full mock, mini mock, or skill practice test. Your active tier:{' '}
                  <span className="font-semibold text-[#0B1F3A]">{user.planName}</span>.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
                <select
                  aria-label="Filter by exam family"
                  value={familyFilter}
                  onChange={(e) => setFamilyFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="ALL">All Exam Families</option>
                  <option value="IELTS_ACADEMIC">IELTS Academic</option>
                  <option value="IELTS_GENERAL">IELTS General</option>
                  <option value="PTE_ACADEMIC">PTE Academic</option>
                  <option value="TOEFL_IBT">TOEFL iBT</option>
                  <option value="GENERAL_ENGLISH">General English</option>
                </select>
                <select
                  aria-label="Filter by skill"
                  value={skillFilter}
                  onChange={(e) => setSkillFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="ALL">All Skills</option>
                  <option value="All">Multi-Skill Full/Mini</option>
                  <option value="Listening">Listening</option>
                  <option value="Reading">Reading</option>
                  <option value="Writing">Writing</option>
                  <option value="Speaking">Speaking</option>
                </select>
                <select
                  aria-label="Filter by access tier"
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="ALL">All Tiers</option>
                  <option value="FREE">Free</option>
                  <option value="BASIC">Basic</option>
                  <option value="PREMIUM">Premium</option>
                </select>
                <select
                  aria-label="Filter by attempt status"
                  value={attemptFilter}
                  onChange={(e) => setAttemptFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="ALL">Attempted &amp; Unattempted</option>
                  <option value="UNATTEMPTED">Unattempted Only</option>
                  <option value="ATTEMPTED">Attempted Only</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExams.map((exam) => {
                  const locked =
                    TIER_RANK[user.planCode] < TIER_RANK[exam.accessTier] &&
                    user.role !== 'admin';
                  return (
                    <div
                      key={exam.id}
                      className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-xs text-slate-500 mb-2">
                          {exam.examFamily.replace('_', ' ')} · {exam.category} · {exam.accessTier}
                        </div>
                        <h2 className="text-base font-bold text-[#0B1F3A]">{exam.title}</h2>
                        <div className="mt-3 text-xs text-slate-600 tabular-nums space-y-1">
                          <div>
                            Duration: {exam.durationMinutes} min · {exam.questionCount} questions
                          </div>
                          <div>
                            Difficulty: {exam.difficulty} · Attempted: {exam.attemptedCount}×
                          </div>
                          {exam.lastScoreLabel && (
                            <div className="text-[#1D4ED8] font-semibold">
                              Last Result: {exam.lastScoreLabel}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        {locked ? (
                          <button
                            type="button"
                            onClick={() => onNavigate('/portal/profile')}
                            className="w-full py-2.5 px-4 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg"
                          >
                            Requires {exam.accessTier} Plan — Upgrade
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onStartExam(exam.slug)}
                            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg"
                          >
                            {exam.lastAttemptStatus === 'in_progress'
                              ? 'Resume In-Progress Sitting'
                              : 'Start Timed Examination'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: RESULTS HISTORY */}
          {activeTab === 'reports' && dash && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h1 className="text-xl font-extrabold text-[#0B1F3A]">Result History &amp; Reports</h1>
              {dash.recentReports.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  No examination reports generated yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="border-b border-slate-200 text-xs text-slate-500">
                      <tr>
                        <th className="py-2.5 pr-4">Report Ref</th>
                        <th className="py-2.5 pr-4">Examination</th>
                        <th className="py-2.5 pr-4">Date</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5 pr-4 text-right">Score</th>
                        <th className="py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dash.recentReports.map((r) => (
                        <tr key={r.report_id}>
                          <td className="py-3 pr-4 font-mono-tabular text-xs font-semibold">
                            {r.report_ref}
                          </td>
                          <td className="py-3 pr-4 font-medium text-[#0B1F3A]">
                            {r.exam_title} (#{r.attempt_number})
                          </td>
                          <td className="py-3 pr-4 text-xs text-slate-500 tabular-nums">
                            {String(r.generated_at).slice(0, 10)}
                          </td>
                          <td className="py-3 pr-4 text-xs capitalize">{r.status}</td>
                          <td className="py-3 pr-4 text-right font-bold text-[#1D4ED8] tabular-nums">
                            {r.overall_label}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => onNavigate(`/portal/reports/${r.report_id}`)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0B1F3A] rounded-lg"
                            >
                              View Report
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PROFILE & SUBSCRIPTIONS */}
          {activeTab === 'profile' && profile && (
            <div className="space-y-8">
              {profileMsg && (
                <div className="border border-emerald-200 bg-emerald-50 text-emerald-900 rounded-xl p-4 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{profileMsg}</span>
                </div>
              )}

              {/* Subscriptions & Webhook Verification */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-[#1D4ED8]" />
                      <span>Subscription &amp; Package Access</span>
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Current Plan: <strong>{profile.planName}</strong> ({profile.planCode}) ·
                      Attempts used: {profile.attemptsUsed} / {profile.maxMonthlyAttempts}
                    </p>
                  </div>
                  <Award className="w-6 h-6 text-[#1D4ED8] hidden sm:block" />
                </div>

                {pendingPayment && (
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                    <div className="text-sm font-bold text-amber-900">
                      Pending Payment Webhook Verification ({pendingPayment.providerRef})
                    </div>
                    <p className="text-xs text-amber-800">
                      Paid access never unlocks from a browser redirect alone. Confirm payment
                      via the server-signed webhook endpoint once your payment provider processes $
                      {(pendingPayment.amountCents / 100).toFixed(2)}.
                    </p>
                    {pendingPayment.paymentMode === 'sandbox' && (
                      <button
                        type="button"
                        onClick={() => void handleSandboxVerifyWebhook()}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#0B1F3A] rounded-lg"
                      >
                        Trigger Sandbox Signed Webhook Confirmation
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans
                    .filter((p) => p.code !== 'FREE')
                    .map((p) => {
                      const priceUsd = Math.round((p.priceCents * (100 - p.discountPercent)) / 100) / 100;
                      const isCurrent = profile.planCode === p.code;
                      return (
                        <div key={p.id} className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-semibold text-[#1D4ED8]">{p.code}</div>
                            <div className="text-base font-bold text-[#0B1F3A] mt-0.5">{p.name}</div>
                            <div className="text-xl font-extrabold text-[#0B1F3A] tabular-nums mt-2">
                              ${priceUsd.toFixed(0)}
                              <span className="text-xs font-normal text-slate-500"> / {p.durationDays}d</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-2">{p.description}</p>
                          </div>
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() =>
                              void handleStartCheckout(
                                p.code as 'BASIC' | 'PREMIUM' | 'INSTITUTIONAL'
                              )
                            }
                            className={`mt-4 w-full py-2 px-3 rounded-lg text-xs font-semibold ${
                              isCurrent
                                ? 'bg-slate-100 text-slate-500 cursor-default'
                                : 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
                            }`}
                          >
                            {isCurrent ? 'Current Active Plan' : `Upgrade to ${p.name}`}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Edit Profile Form */}
              <form
                onSubmit={handleSaveProfile}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
              >
                <h2 className="text-lg font-bold text-[#0B1F3A]">Candidate Profile Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="prof-name" className="block text-xs font-medium text-slate-700 mb-1">
                      Full Name
                    </label>
                    <input
                      id="prof-name"
                      type="text"
                      required
                      value={profileForm.fullName}
                      onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="prof-country" className="block text-xs font-medium text-slate-700 mb-1">
                      Country
                    </label>
                    <input
                      id="prof-country"
                      type="text"
                      required
                      value={profileForm.country}
                      onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="prof-exam" className="block text-xs font-medium text-slate-700 mb-1">
                      Preferred Examination
                    </label>
                    <select
                      id="prof-exam"
                      value={profileForm.preferredExam}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          preferredExam: e.target.value as ExamFamily,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="IELTS_ACADEMIC">IELTS Academic</option>
                      <option value="IELTS_GENERAL">IELTS General Training</option>
                      <option value="PTE_ACADEMIC">PTE Academic</option>
                      <option value="TOEFL_IBT">TOEFL iBT</option>
                      <option value="GENERAL_ENGLISH">General English CEFR</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="prof-target" className="block text-xs font-medium text-slate-700 mb-1">
                      Target Score
                    </label>
                    <input
                      id="prof-target"
                      type="text"
                      required
                      value={profileForm.targetScore}
                      onChange={(e) => setProfileForm({ ...profileForm, targetScore: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="prof-obj" className="block text-xs font-medium text-slate-700 mb-1">
                      Study or Career Objective
                    </label>
                    <input
                      id="prof-obj"
                      type="text"
                      required
                      value={profileForm.objective}
                      onChange={(e) => setProfileForm({ ...profileForm, objective: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#132D52] rounded-lg"
                >
                  Save Profile Changes
                </button>
              </form>

              {/* Account Deletion */}
              <div className="bg-white border border-red-200 rounded-xl p-6 space-y-3">
                <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Delete Candidate Account</span>
                </div>
                <p className="text-xs text-slate-600">
                  Permanently remove your account, saved answers, and score history.
                </p>
                {!deleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="px-4 py-2 text-xs font-semibold text-red-700 border border-red-300 rounded-lg hover:bg-red-50"
                  >
                    Request Account Deletion
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleDeleteAccount()}
                      className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                    >
                      Confirm Permanent Deletion
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      className="px-4 py-2 text-xs font-medium text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
