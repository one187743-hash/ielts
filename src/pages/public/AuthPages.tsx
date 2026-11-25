import React, { useState } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import { apiFetch, setAuthToken } from '../../lib/api';
import type { ExamFamily, UserSession } from '../../lib/types';

export function LoginPage({
  onAuthSuccess,
  onNavigate,
}: {
  onAuthSuccess: (user: UserSession) => void;
  onNavigate: (path: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submitLogin = async (targetEmail: string, targetPassword: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: UserSession }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });
      setAuthToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14 space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-extrabold text-[#0B1F3A]">Candidate Sign In</h1>
        <p className="text-sm text-slate-600">
          Access your examination dashboard, active attempts, and result reports.
        </p>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-900 rounded-xl p-3.5 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitLogin(email, password);
        }}
        className="border border-slate-200 rounded-xl p-6 bg-white space-y-4"
      >
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1">
            Email Address
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="flex items-center justify-between text-xs pt-2">
          <button
            type="button"
            onClick={() => onNavigate('/forgot-password')}
            className="text-[#1D4ED8] hover:underline"
          >
            Forgot password?
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="text-slate-700 font-semibold hover:underline"
          >
            Create Candidate Account
          </button>
        </div>
      </form>

      <div className="border border-slate-200 rounded-xl p-4 bg-[#F8FAFC] space-y-3">
        <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          <span>Demo Accounts for Evaluation</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => void submitLogin('student@meridian-assessment.org', 'Meridian2026!')}
            className="w-full text-left px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg hover:border-[#1D4ED8] transition-colors"
          >
            <div className="font-semibold text-[#0B1F3A]">Amara Okafor · Comprehensive Plan</div>
            <div className="text-slate-500">student@meridian-assessment.org (Includes history &amp; AI access)</div>
          </button>
          <button
            type="button"
            onClick={() => void submitLogin('starter@meridian-assessment.org', 'Meridian2026!')}
            className="w-full text-left px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg hover:border-[#1D4ED8] transition-colors"
          >
            <div className="font-semibold text-[#0B1F3A]">Kenji Takahashi · Foundation Free Plan</div>
            <div className="text-slate-500">starter@meridian-assessment.org (Free tier limits)</div>
          </button>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage({
  onAuthSuccess,
  onNavigate,
}: {
  onAuthSuccess: (user: UserSession) => void;
  onNavigate: (path: string) => void;
}) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    country: 'United Kingdom',
    city: '',
    educationLevel: 'Postgraduate',
    preferredExam: 'IELTS_ACADEMIC' as ExamFamily,
    targetScore: '7.5',
    intendedExamDate: '',
    objective: 'University Admission',
    privacyConsent: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyStep, setVerifyStep] = useState<{ user: UserSession; notice: string } | null>(null);
  const [code, setCode] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.privacyConsent) {
      setError('Please accept the privacy policy consent to register.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{
        token: string;
        user: UserSession;
        verificationNotice: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setAuthToken(res.token);
      setVerifyStep({ user: res.user, notice: res.verificationNotice });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyStep) return;
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      onAuthSuccess({ ...verifyStep.user, emailVerified: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  if (verifyStep) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 space-y-6">
        <div className="border border-slate-200 rounded-xl p-6 bg-white space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Account Created — Verify Email</span>
          </div>
          <p className="text-sm text-slate-600">{verifyStep.notice}</p>
          {error && (
            <div className="border border-red-200 bg-red-50 text-red-900 rounded-lg p-3 text-xs">
              {error}
            </div>
          )}
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label htmlFor="verify-code" className="block text-sm font-medium text-slate-700 mb-1">
                6-Digit Verification Code
              </label>
              <input
                id="verify-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg font-mono-tabular text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg"
              >
                Verify &amp; Continue
              </button>
              <button
                type="button"
                onClick={() => onAuthSuccess(verifyStep.user)}
                className="py-2.5 px-4 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Skip for now
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-[#0B1F3A]">Candidate Registration</h1>
        <p className="text-sm text-slate-600">
          Create your candidate profile. Includes complimentary access to the CEFR Diagnostic and IELTS Series 01.
        </p>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-900 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="border border-slate-200 rounded-xl p-6 sm:p-8 bg-white space-y-6">
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Personal Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1">
                Email Address *
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-pass" className="block text-sm font-medium text-slate-700 mb-1">
                Password (8+ characters) *
              </label>
              <input
                id="reg-pass"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number (Optional)
              </label>
              <input
                id="reg-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-country" className="block text-sm font-medium text-slate-700 mb-1">
                Country *
              </label>
              <input
                id="reg-country"
                type="text"
                required
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-city" className="block text-sm font-medium text-slate-700 mb-1">
                City (Optional)
              </label>
              <input
                id="reg-city"
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Academic Objectives
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-edu" className="block text-sm font-medium text-slate-700 mb-1">
                Education Level *
              </label>
              <select
                id="reg-edu"
                value={form.educationLevel}
                onChange={(e) => setForm({ ...form, educationLevel: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="Secondary / High School">Secondary / High School</option>
                <option value="Undergraduate">Undergraduate</option>
                <option value="Postgraduate">Postgraduate</option>
                <option value="Doctoral / Research">Doctoral / Research</option>
                <option value="Professional">Professional</option>
              </select>
            </div>
            <div>
              <label htmlFor="reg-exam" className="block text-sm font-medium text-slate-700 mb-1">
                Preferred Examination *
              </label>
              <select
                id="reg-exam"
                value={form.preferredExam}
                onChange={(e) => setForm({ ...form, preferredExam: e.target.value as ExamFamily })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="IELTS_ACADEMIC">IELTS Academic</option>
                <option value="IELTS_GENERAL">IELTS General Training</option>
                <option value="PTE_ACADEMIC">PTE Academic</option>
                <option value="TOEFL_IBT">TOEFL iBT</option>
                <option value="GENERAL_ENGLISH">General English CEFR</option>
              </select>
            </div>
            <div>
              <label htmlFor="reg-target" className="block text-sm font-medium text-slate-700 mb-1">
                Target Score *
              </label>
              <input
                id="reg-target"
                type="text"
                required
                value={form.targetScore}
                onChange={(e) => setForm({ ...form, targetScore: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-date" className="block text-sm font-medium text-slate-700 mb-1">
                Intended Exam Date (Optional)
              </label>
              <input
                id="reg-date"
                type="date"
                value={form.intendedExamDate}
                onChange={(e) => setForm({ ...form, intendedExamDate: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="reg-obj" className="block text-sm font-medium text-slate-700 mb-1">
                Study or Career Objective *
              </label>
              <input
                id="reg-obj"
                type="text"
                required
                value={form.objective}
                onChange={(e) => setForm({ ...form, objective: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 pt-2">
          <input
            id="reg-consent"
            type="checkbox"
            checked={form.privacyConsent}
            onChange={(e) => setForm({ ...form, privacyConsent: e.target.checked })}
            className="mt-1 rounded border-slate-300"
          />
          <label htmlFor="reg-consent" className="text-xs text-slate-600 leading-relaxed">
            I consent to Meridian Assessment storing my profile and examination responses in
            accordance with the{' '}
            <button
              type="button"
              onClick={() => onNavigate('/privacy')}
              className="text-[#1D4ED8] underline"
            >
              Privacy Policy
            </button>{' '}
            and{' '}
            <button
              type="button"
              onClick={() => onNavigate('/terms')}
              className="text-[#1D4ED8] underline"
            >
              Terms &amp; Conditions
            </button>
            .
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg disabled:opacity-60"
        >
          {loading ? 'Creating Account...' : 'Create Candidate Account'}
        </button>
      </form>
    </div>
  );
}

export function ForgotPasswordPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, token, newPassword }),
      });
      setMessage(res.message);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14 space-y-6">
      <h1 className="text-2xl font-extrabold text-[#0B1F3A]">Password Recovery</h1>
      {error && (
        <div className="border border-red-200 bg-red-50 text-red-900 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="border border-blue-200 bg-blue-50 text-blue-900 rounded-lg p-3 text-sm">
          {message}
        </div>
      )}

      {step === 'request' && (
        <form onSubmit={handleRequest} className="border border-slate-200 rounded-xl p-6 bg-white space-y-4">
          <div>
            <label htmlFor="rec-email" className="block text-sm font-medium text-slate-700 mb-1">
              Registered Email Address
            </label>
            <input
              id="rec-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1D4ED8] rounded-lg"
          >
            Request Recovery Token
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleReset} className="border border-slate-200 rounded-xl p-6 bg-white space-y-4">
          <div>
            <label htmlFor="rec-token" className="block text-sm font-medium text-slate-700 mb-1">
              Recovery Token
            </label>
            <input
              id="rec-token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg font-mono-tabular text-sm"
            />
          </div>
          <div>
            <label htmlFor="rec-pass" className="block text-sm font-medium text-slate-700 mb-1">
              New Password (8+ chars)
            </label>
            <input
              id="rec-pass"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1D4ED8] rounded-lg"
          >
            Update Password
          </button>
        </form>
      )}

      {step === 'done' && (
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#0B1F3A] rounded-lg"
        >
          Return to Sign In
        </button>
      )}
    </div>
  );
}
