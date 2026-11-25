import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  Headphones,
  Mic,
  PenTool,
  ShieldCheck,
} from 'lucide-react';
import type { ExamSummary, StudyResource, UserSession } from '../../lib/types';

interface HomePageProps {
  exams: ExamSummary[];
  resources: StudyResource[];
  user: UserSession | null;
  onNavigate: (path: string) => void;
  onLaunchExam: (slug: string) => void;
}

function ImageWithFallback({
  src,
  alt,
  title,
  className = '',
}: {
  src: string;
  alt: string;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0B1F3A] to-[#1E3A8A] text-white p-6 text-center ${className}`}
      >
        <BookOpen className="w-8 h-8 mb-2 opacity-80" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function HomePage({
  exams,
  resources,
  user,
  onNavigate,
  onLaunchExam,
}: HomePageProps) {
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);

  const banner = resources.find((r) => r.resourceType === 'Banner');
  const faqs = resources.filter((r) => r.resourceType === 'FAQ');

  const examShowcase = [
    {
      title: 'IELTS Academic & General',
      kicker: 'Bands 1.0 – 9.0 · 4 Criteria Rubrics',
      description:
        'Timed Listening with map labelling, split-screen Academic Reading with True/False/Not Given, Task 1 & 2 essays, and 3-part Speaking.',
      image: '/src/assets/images/exam_ielts_academic_1795592587353.jpg',
      path: '/ielts',
      cta: 'Explore IELTS',
    },
    {
      title: 'PTE Academic',
      kicker: 'Scale 10 – 90 · Integrated Tasks',
      description:
        'Read Aloud, Repeat Sentence, Describe Image, Retell Lecture, Re-order Paragraphs, Summarize Written & Spoken Text, and Dictation.',
      image: '/src/assets/images/exam_pte_digital_1795592587411.jpg',
      path: '/pte',
      cta: 'Explore PTE',
    },
    {
      title: 'TOEFL iBT',
      kicker: 'Scale 0 – 120 · Academic Discourse',
      description:
        'Configurable Reading, Listening, Independent & Integrated Speaking, and Writing for an Academic Discussion.',
      image: '/src/assets/images/exam_toefl_study_1795592588295.jpg',
      path: '/toefl',
      cta: 'Explore TOEFL',
    },
  ];

  const howItWorks = [
    {
      step: '01.',
      title: 'Set Your Target Exam & Benchmark',
      body: 'Register with your target examination family, band or scale goal, and intended exam date to personalize your study track.',
    },
    {
      step: '02.',
      title: 'Sit Timed Computer-Based Mocks',
      body: 'Complete authentic Listening, Reading, Writing, and Speaking modules with server-validated timers and continuous autosave.',
    },
    {
      step: '03.',
      title: 'Receive Rubric & AI Diagnostics',
      body: 'Objective answers grade immediately while Writing and Speaking receive transparent 4-criteria rubric feedback or examiner moderation.',
    },
    {
      step: '04.',
      title: 'Download QR-Verified Reports',
      body: 'Export clean PDF practice reports stamped with a unique verification code and longitudinal skill-by-skill progress charts.',
    },
  ];

  const modules = [
    {
      icon: Headphones,
      name: 'Listening',
      detail: 'Academic briefings, lectures, multiple choice, form & sentence completion, map labelling, and dictation.',
    },
    {
      icon: BookOpen,
      name: 'Reading',
      detail: 'Split-pane academic passages, True/False/Not Given, Yes/No/Not Given, matching headings, and re-order paragraphs.',
    },
    {
      icon: PenTool,
      name: 'Writing',
      detail: 'Task 1 data charts, formal correspondence, academic essays, live word counters, and criteria-level evaluation.',
    },
    {
      icon: Mic,
      name: 'Speaking',
      detail: 'Preparation countdowns, in-browser microphone recording, playback, audio transcription, and fluency feedback.',
    },
  ];

  const testimonials = [
    {
      quote:
        'Seeing my Task 2 Coherence and Lexical Resource broken down separately made my revision targeted. I moved from Band 6.5 to 7.5 across four timed mocks in six weeks.',
      name: 'Nadia Al-Mansoor',
      role: 'MSc Public Policy Applicant · London',
    },
    {
      quote:
        'The PTE Re-order Paragraphs and Write from Dictation drills mirror real pacing under pressure. Having verifiable PDF reports kept our university prep cohort accountable.',
      name: 'Daniela Ferreira',
      role: 'Academic English Coordinator · São Paulo',
    },
    {
      quote:
        'My browser disconnected halfway through an Academic Reading section—when I reconnected, every answer and flagged question resumed with exact remaining time.',
      name: 'Rohan Kulkarni',
      role: 'Engineering Postgraduate · Melbourne',
    },
  ];

  return (
    <div>
      {/* Optional Announcement Strip */}
      {banner && (
        <div className="bg-[#0B1F3A] text-slate-100 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-amber-300">Announcement</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>{banner.title}</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(user ? '/portal' : '/register')}
              className="text-xs font-semibold text-white underline underline-offset-4 hover:text-blue-200 whitespace-nowrap shrink-0"
            >
              Start Diagnostic
            </button>
          </div>
        </div>
      )}

      {/* 2 & 3. Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="text-xs font-semibold tracking-wider uppercase text-[#1D4ED8]">
              International English Language Testing &amp; Preparation
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-extrabold tracking-tight text-[#0B1F3A] leading-[1.1]">
              Precision mock examinations for IELTS, PTE, and TOEFL candidates.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Prepare in an authentic computer-delivered testing environment with server-timed sections,
              transparent 4-criteria rubric evaluation, and QR-verified diagnostic reports.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => onNavigate(user ? '/portal/exams' : '/register')}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>Start Your Test</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/mock-tests')}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>Explore Exams</span>
              </button>
            </div>
            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
              <span>CEFR A2 – C2 Aligned</span>
              <span aria-hidden="true">·</span>
              <span>Server-Validated Timers &amp; Autosave</span>
              <span aria-hidden="true">·</span>
              <span>Independent Practice Reports</span>
            </div>
          </div>

          <div className="lg:col-span-6 flex">
            <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[16/9] lg:aspect-auto lg:min-h-[420px]">
              <ImageWithFallback
                src="/src/assets/images/hero_exam_campus_1795592586627.jpg"
                alt="International university examination atrium with students preparing at oak study desks"
                title="Meridian Examination Atrium"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. IELTS, PTE, and TOEFL Showcase Cards */}
      <section className="bg-[#F8FAFC] py-16 lg:py-20 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0B1F3A]">
                Dedicated preparation for global proficiency benchmarks
              </h2>
              <p className="text-slate-600 mt-2 max-w-2xl">
                Every examination track follows current section structures, timing constraints, and
                configurable scoring scales.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/general-english')}
              className="text-sm font-semibold text-[#1D4ED8] hover:underline self-start md:self-auto whitespace-nowrap"
            >
              View General English CEFR Assessment →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {examShowcase.map((item) => (
              <article
                key={item.title}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-200">
                  <ImageWithFallback
                    src={item.image}
                    alt={item.title}
                    title={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="text-xs font-medium text-slate-500 mb-1.5">{item.kicker}</div>
                  <h3 className="text-lg font-bold text-[#0B1F3A] mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed flex-1">{item.description}</p>
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onNavigate(item.path)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
                    >
                      <span>{item.cta}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. How It Works */}
      <section className="bg-white py-16 lg:py-20 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0B1F3A]">
              How the assessment workflow operates
            </h2>
            <p className="text-slate-600 mt-2">
              From diagnostic registration to verified score reporting, every stage is engineered for
              reliability and academic transparency.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item) => (
              <div key={item.step} className="space-y-3 pt-4 border-t border-slate-200">
                <div className="text-sm font-bold font-mono-tabular text-[#1D4ED8]">{item.step}</div>
                <h3 className="text-base font-bold text-[#0B1F3A]">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Examination Modules */}
      <section className="bg-[#0B1F3A] text-white py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">Four integrated examination modules</h2>
            <p className="text-slate-300 mt-2">
              Practice individual skills or complete full-length simulated sittings with authentic question formats.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.name}
                  className="bg-[#132D52] border border-slate-700/80 rounded-xl p-6 space-y-3"
                >
                  <Icon className="w-6 h-6 text-blue-300" />
                  <h3 className="text-lg font-bold">{m.name}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{m.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. Featured Mock Tests from Database */}
      <section className="bg-white py-16 lg:py-20 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0B1F3A]">
                Featured mock examinations
              </h2>
              <p className="text-slate-600 mt-2">
                Published tests ready for immediate sitting in the examination engine.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/mock-tests')}
              className="text-sm font-semibold text-[#1D4ED8] hover:underline self-start sm:self-auto"
            >
              Browse full catalog →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.slice(0, 6).map((exam) => (
              <div
                key={exam.id}
                className="border border-slate-200 rounded-xl p-6 flex flex-col justify-between bg-white hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-2">
                    <span>{exam.examFamily.replace('_', ' ')}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{exam.category}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{exam.accessTier}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#0B1F3A] mb-3">{exam.title}</h3>
                  <div className="text-xs text-slate-600 tabular-nums space-y-1">
                    <div>Duration: {exam.durationMinutes} minutes</div>
                    <div>Questions: {exam.questionCount} items · Level: {exam.difficulty}</div>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{exam.primarySkill} Skills</span>
                  <button
                    type="button"
                    onClick={() => onLaunchExam(exam.slug)}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0B1F3A] hover:bg-[#132D52] rounded-lg transition-colors whitespace-nowrap"
                  >
                    Start Exam
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8 & 9. Platform Benefits & Performance Features */}
      <section className="bg-[#F8FAFC] py-16 lg:py-20 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0B1F3A]">
              Built for rigorous academic preparation and institutional trust
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Every diagnostic report clearly distinguishes unofficial practice bands from official
              test-centre certificates while preserving full auditability and rubric transparency.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('/verify')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1D4ED8] hover:underline"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify a Result Report Code</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: CheckCircle2,
                title: 'Transparent 4-Criteria Rubrics',
                text: 'Writing and Speaking feedback maps directly to Task Response, Coherence, Lexical Resource, and Grammatical Accuracy—never opaque scores.',
              },
              {
                icon: FileCheck2,
                title: 'PDF & QR Verification Registry',
                text: 'Generate clean downloadable practice PDFs containing a unique QR code that academies or mentors can verify online.',
              },
              {
                icon: ShieldCheck,
                title: 'Examiner Moderation & Pending States',
                text: 'When AI evaluation is unavailable or human review is requested, attempts queue cleanly for administrator scoring with audit logs.',
              },
              {
                icon: BookOpen,
                title: 'Longitudinal Weakness Tracking',
                text: 'Compare Listening, Reading, Writing, and Speaking averages across sittings to isolate grammar and coherence patterns.',
              },
            ].map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="bg-white border border-slate-200 rounded-xl p-6 space-y-2.5">
                  <Icon className="w-5 h-5 text-[#1D4ED8]" />
                  <h3 className="text-base font-bold text-[#0B1F3A]">{feat.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{feat.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 10. Testimonials */}
      <section className="bg-white py-16 lg:py-20 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0B1F3A] mb-10">
            Candidate and coordinator perspectives
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <blockquote
                key={t.name}
                className="border border-slate-200 rounded-xl p-6 flex flex-col justify-between bg-white"
              >
                <p className="text-sm text-slate-700 leading-relaxed">“{t.quote}”</p>
                <footer className="mt-5 pt-4 border-t border-slate-100">
                  <div className="text-sm font-bold text-[#0B1F3A]">{t.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.role}</div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* 11. FAQ Section */}
      <section className="bg-[#F8FAFC] py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0B1F3A] mb-8">
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    aria-expanded={isOpen}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 font-semibold text-[#0B1F3A] hover:bg-slate-50 transition-colors"
                  >
                    <span>{faq.title}</span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                      {faq.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
