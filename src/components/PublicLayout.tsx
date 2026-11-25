import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { MeridianLogoMark } from './BrandMark';
import type { UserSession } from '../lib/types';

interface PublicLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  user: UserSession | null;
  children: React.ReactNode;
}

export function PublicLayout({
  currentPath,
  onNavigate,
  user,
  children,
}: PublicLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Exams', path: '/ielts' },
    { label: 'Mock Tests', path: '/mock-tests' },
    { label: 'Resources', path: '/resources' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'About', path: '/about' },
  ];

  const handleLink = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setMobileOpen(false);
    onNavigate(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => handleLink(e, '/')}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#0B1F3A] whitespace-nowrap shrink-0 font-display"
          >
            <MeridianLogoMark className="w-7 h-7 shrink-0" />
            <span>Meridian Assessment</span>
          </a>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600" aria-label="Primary Navigation">
            {navItems.map((item) => {
              const active =
                currentPath === item.path ||
                (item.path === '/ielts' &&
                  ['/ielts', '/pte', '/toefl', '/general-english'].includes(currentPath));
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => handleLink(e, item.path)}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    active
                      ? 'text-[#0B1F3A] border-[#1D4ED8] font-semibold'
                      : 'border-transparent hover:text-[#0B1F3A] hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href={user ? (user.role === 'admin' ? '/admin' : '/portal') : '/login'}
              onClick={(e) =>
                handleLink(e, user ? (user.role === 'admin' ? '/admin' : '/portal') : '/login')
              }
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#132D52] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {user ? (user.role === 'admin' ? 'Admin Console' : 'Student Portal') : 'Student Portal'}
            </a>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => handleLink(e, item.path)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {item.label}
              </a>
            ))}
            <a
              href="/verify"
              onClick={(e) => handleLink(e, '/verify')}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Verify Report
            </a>
            <a
              href={user ? '/portal' : '/login'}
              onClick={(e) => handleLink(e, user ? '/portal' : '/login')}
              className="block text-center mt-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#0B1F3A]"
            >
              {user ? 'Open Portal' : 'Student Portal'}
            </a>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-[#0B1F3A] text-slate-300 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-base font-display">
              <MeridianLogoMark className="w-6 h-6" />
              <span>Meridian Assessment</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Independent international English language testing and structured mock examination
              platform for academic admission and professional readiness.
            </p>
            <p className="text-xs text-slate-400">
              All practice scores and downloadable reports are independent unofficial diagnostics.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Examinations</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="/ielts" onClick={(e) => handleLink(e, '/ielts')} className="hover:text-white transition-colors">
                  IELTS Academic &amp; General
                </a>
              </li>
              <li>
                <a href="/pte" onClick={(e) => handleLink(e, '/pte')} className="hover:text-white transition-colors">
                  PTE Academic
                </a>
              </li>
              <li>
                <a href="/toefl" onClick={(e) => handleLink(e, '/toefl')} className="hover:text-white transition-colors">
                  TOEFL iBT
                </a>
              </li>
              <li>
                <a href="/general-english" onClick={(e) => handleLink(e, '/general-english')} className="hover:text-white transition-colors">
                  General English CEFR
                </a>
              </li>
              <li>
                <a href="/mock-tests" onClick={(e) => handleLink(e, '/mock-tests')} className="hover:text-white transition-colors">
                  Mock Test Library
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Platform</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="/resources" onClick={(e) => handleLink(e, '/resources')} className="hover:text-white transition-colors">
                  Preparation Resources
                </a>
              </li>
              <li>
                <a href="/pricing" onClick={(e) => handleLink(e, '/pricing')} className="hover:text-white transition-colors">
                  Packages &amp; Pricing
                </a>
              </li>
              <li>
                <a href="/verify" onClick={(e) => handleLink(e, '/verify')} className="hover:text-white transition-colors">
                  Verify a Result Report
                </a>
              </li>
              <li>
                <a href="/register" onClick={(e) => handleLink(e, '/register')} className="hover:text-white transition-colors">
                  Candidate Registration
                </a>
              </li>
              <li>
                <a href="/admin" onClick={(e) => handleLink(e, '/admin')} className="hover:text-white transition-colors">
                  Administrator Portal
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Governance &amp; Support</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="/about" onClick={(e) => handleLink(e, '/about')} className="hover:text-white transition-colors">
                  About Meridian
                </a>
              </li>
              <li>
                <a href="/contact" onClick={(e) => handleLink(e, '/contact')} className="hover:text-white transition-colors">
                  Contact Support
                </a>
              </li>
              <li>
                <a href="/privacy" onClick={(e) => handleLink(e, '/privacy')} className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" onClick={(e) => handleLink(e, '/terms')} className="hover:text-white transition-colors">
                  Terms &amp; Conditions
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <span>© {new Date().getFullYear()} Meridian Assessment. Independent English Testing Platform.</span>
            <span>Not affiliated with IELTS Partners, Pearson, or ETS.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
