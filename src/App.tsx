import React, { useEffect, useState } from 'react';
import { apiFetch, setAuthToken } from './lib/api';
import type { ExamSummary, StudyResource, SubscriptionPlan, UserSession } from './lib/types';
import { PublicLayout } from './components/PublicLayout';
import { HomePage } from './pages/public/HomePage';
import {
  AboutPublicPage,
  ContactPublicPage,
  ExamFamilyPage,
  LegalPage,
  MockTestsPublicPage,
  PricingPublicPage,
  ResourcesPublicPage,
  VerifyReportPage,
} from './pages/public/PublicSubpages';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/public/AuthPages';
import { StudentPortal } from './pages/student/StudentPortal';
import { ExamEngine } from './pages/student/ExamEngine';
import { ResultReportView } from './pages/student/ResultReportView';
import { AdminPortal } from './pages/admin/AdminPortal';

export default function App() {
  const [path, setPath] = useState<string>(() => window.location.pathname || '/');
  const [user, setUser] = useState<UserSession | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [publicData, setPublicData] = useState<{
    exams: ExamSummary[];
    plans: SubscriptionPlan[];
    resources: StudyResource[];
  }>({ exams: [], plans: [], resources: [] });

  const [launchError, setLaunchError] = useState('');

  const navigate = (nextPath: string) => {
    setLaunchError('');
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshPublicOverview = async () => {
    try {
      const ov = await apiFetch<{
        exams: ExamSummary[];
        plans: SubscriptionPlan[];
        resources: StudyResource[];
      }>('/api/public/overview');
      setPublicData(ov);
    } catch {
      // handled gracefully
    }
  };

  useEffect(() => {
    void refreshPublicOverview();
    void apiFetch<{ user: UserSession | null }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
      })
      .finally(() => setAuthReady(true));
  }, []);

  const handleLaunchExam = async (slug: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setLaunchError('');
    try {
      const res = await apiFetch<{ attempt: { id: number } }>(`/api/exams/${slug}/start`, {
        method: 'POST',
      });
      navigate(`/portal/attempt/${res.attempt.id}`);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Unable to start examination.');
      navigate('/portal/exams');
    }
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAuthToken(null);
    setUser(null);
    navigate('/');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-sm text-slate-600">
        Loading Meridian Assessment...
      </div>
    );
  }

  // Admin Portal Route
  if (path === '/admin' || path.startsWith('/admin/')) {
    return (
      <AdminPortal
        user={user}
        onAuthSuccess={(u) => {
          setUser(u);
          navigate('/admin');
        }}
        onLogout={() => void handleLogout()}
        onNavigate={navigate}
      />
    );
  }

  // Examination Engine Route
  const attemptMatch = path.match(/^\/portal\/attempt\/(\d+)$/);
  if (attemptMatch) {
    if (!user) {
      navigate('/login');
      return null;
    }
    return (
      <ExamEngine
        attemptId={Number(attemptMatch[1])}
        onSubmitted={(reportId) => navigate(`/portal/reports/${reportId}`)}
        onExitPortal={() => navigate('/portal/exams')}
      />
    );
  }

  // Result Report Detail Route
  const reportMatch = path.match(/^\/portal\/reports\/(\d+)$/);
  if (reportMatch) {
    if (!user) {
      navigate('/login');
      return null;
    }
    return (
      <ResultReportView
        reportId={Number(reportMatch[1])}
        onBack={() => navigate('/portal/reports')}
        onNavigate={navigate}
      />
    );
  }

  // Student Portal Routes
  if (path === '/portal' || path.startsWith('/portal/')) {
    if (!user) {
      navigate('/login');
      return null;
    }
    const activeTab =
      path === '/portal/exams'
        ? 'exams'
        : path === '/portal/reports'
          ? 'reports'
          : path === '/portal/profile'
            ? 'profile'
            : 'overview';
    return (
      <>
        {launchError && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 text-center">
            {launchError}
          </div>
        )}
        <StudentPortal
          user={user}
          activeTab={activeTab}
          onNavigate={navigate}
          onStartExam={(slug) => void handleLaunchExam(slug)}
          onLogout={() => void handleLogout()}
        />
      </>
    );
  }

  // Public Website Routes
  const verifyMatch = path.match(/^\/verify\/([^/]+)$/);

  return (
    <PublicLayout currentPath={path} onNavigate={navigate} user={user}>
      {path === '/' && (
        <HomePage
          exams={publicData.exams}
          resources={publicData.resources}
          user={user}
          onNavigate={navigate}
          onLaunchExam={(slug) => void handleLaunchExam(slug)}
        />
      )}
      {path === '/ielts' && (
        <ExamFamilyPage
          family="IELTS"
          exams={publicData.exams}
          onLaunchExam={(slug) => void handleLaunchExam(slug)}
          onNavigate={navigate}
        />
      )}
      {path === '/pte' && (
        <ExamFamilyPage
          family="PTE"
          exams={publicData.exams}
          onLaunchExam={(slug) => void handleLaunchExam(slug)}
          onNavigate={navigate}
        />
      )}
      {path === '/toefl' && (
        <ExamFamilyPage
          family="TOEFL"
          exams={publicData.exams}
          onLaunchExam={(slug) => void handleLaunchExam(slug)}
          onNavigate={navigate}
        />
      )}
      {path === '/general-english' && (
        <ExamFamilyPage
          family="GENERAL"
          exams={publicData.exams}
          onLaunchExam={(slug) => void handleLaunchExam(slug)}
          onNavigate={navigate}
        />
      )}
      {path === '/mock-tests' && (
        <MockTestsPublicPage
          exams={publicData.exams}
          onLaunchExam={(slug) => void handleLaunchExam(slug)}
        />
      )}
      {path === '/resources' && <ResourcesPublicPage resources={publicData.resources} />}
      {path === '/pricing' && (
        <PricingPublicPage
          plans={publicData.plans}
          onSelectPlan={(code) => {
            if (!user) {
              navigate(code === 'FREE' ? '/register' : '/login');
            } else {
              navigate('/portal/profile');
            }
          }}
        />
      )}
      {path === '/about' && <AboutPublicPage />}
      {path === '/contact' && <ContactPublicPage />}
      {path === '/privacy' && <LegalPage type="privacy" />}
      {path === '/terms' && <LegalPage type="terms" />}
      {(path === '/verify' || verifyMatch) && (
        <VerifyReportPage initialCode={verifyMatch ? decodeURIComponent(verifyMatch[1]) : undefined} />
      )}
      {path === '/login' && (
        <LoginPage
          onAuthSuccess={(u) => {
            setUser(u);
            navigate(u.role === 'admin' ? '/admin' : '/portal');
          }}
          onNavigate={navigate}
        />
      )}
      {path === '/register' && (
        <RegisterPage
          onAuthSuccess={(u) => {
            setUser(u);
            navigate('/portal');
          }}
          onNavigate={navigate}
        />
      )}
      {path === '/forgot-password' && <ForgotPasswordPage onNavigate={navigate} />}
    </PublicLayout>
  );
}
