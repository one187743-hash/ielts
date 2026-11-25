import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Download,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch, getAuthToken } from '../../lib/api';
import type { ResultReportDetail } from '../../lib/types';

export function ResultReportView({
  reportId,
  onBack,
  onNavigate,
}: {
  reportId: number;
  onBack: () => void;
  onNavigate: (path: string) => void;
}) {
  const [data, setData] = useState<{
    report: ResultReportDetail;
    verifyUrl: string;
    qrDataUrl: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{
          report: ResultReportDetail;
          verifyUrl: string;
          qrDataUrl: string;
        }>(`/api/reports/${reportId}`);
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load report.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [reportId]);

  const handleDownloadPdf = async () => {
    setPdfError('');
    try {
      const headers = new Headers();
      const token = getAuthToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const res = await fetch(`/api/reports/${reportId}/pdf`, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || 'PDF download unavailable on your current plan.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data?.report.reportRef || 'meridian-report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Failed to download PDF.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-sm text-slate-600">
        Loading unofficial assessment report...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="border border-red-200 bg-red-50 text-red-900 rounded-xl p-4 text-sm">
          {error || 'Report unavailable.'}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-xs font-semibold bg-[#0B1F3A] text-white rounded-lg"
        >
          Back to Portal
        </button>
      </div>
    );
  }

  const { report, qrDataUrl } = data;

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B1F3A] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Results</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate(`/verify/${report.verificationCode}`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-slate-300 bg-white rounded-lg text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Public Verification Page</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Unofficial PDF</span>
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="border border-amber-200 bg-amber-50 text-amber-900 rounded-xl p-3.5 text-xs">
            {pdfError}
          </div>
        )}

        {/* Unofficial Notice */}
        <div className="border border-amber-200 bg-amber-50 text-amber-950 rounded-xl p-4 flex items-start gap-3 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>{report.disclaimer}</span>
        </div>

        {/* Report Header Card */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-[#0B1F3A] text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="text-xs text-slate-300 font-mono-tabular">
                Report {report.reportRef} · Candidate {report.candidateRef} · Attempt #{report.attemptNumber}
              </div>
              <h1 className="text-2xl font-extrabold">{report.examTitle}</h1>
              <div className="text-sm text-slate-300">
                Candidate: <strong className="text-white">{report.candidateName}</strong> · Date:{' '}
                {new Date(report.examDate).toLocaleDateString()} · Status:{' '}
                <span className="capitalize font-semibold text-blue-200">{report.status}</span>
              </div>
            </div>

            <div className="flex items-center gap-5 shrink-0">
              <div className="text-right">
                <div className="text-xs text-slate-300">Overall Estimated Score</div>
                <div className="text-3xl font-extrabold tabular-nums">{report.overallLabel}</div>
                <div className="text-xs text-blue-200 font-semibold">CEFR {report.cefrLevel}</div>
              </div>
              <div className="bg-white p-1.5 rounded-lg">
                <img
                  src={qrDataUrl}
                  alt={`QR verification code ${report.verificationCode}`}
                  className="w-20 h-20"
                />
              </div>
            </div>
          </div>

          {/* Skill Breakdown */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-b border-slate-200">
            {report.skillScores.map((s) => (
              <div key={s.skill} className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase">{s.skill}</div>
                <div className="text-xl font-extrabold text-[#0B1F3A] tabular-nums mt-1">
                  {s.label}
                </div>
                {s.criteria.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-200 space-y-1">
                    {s.criteria.map((c) => (
                      <div key={c.name} className="flex justify-between text-xs text-slate-600">
                        <span className="truncate pr-2">{c.name}</span>
                        <span className="font-mono-tabular font-semibold">{c.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* AI / Examiner Feedback */}
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0B1F3A]">
                Criteria Diagnostics &amp; Improvement Guidance
              </h2>
              {report.aiModelVersion && (
                <span className="text-xs font-mono-tabular text-slate-500">
                  Assessor Version: {report.aiModelVersion}
                </span>
              )}
            </div>

            {report.reviewNotes && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 text-xs text-blue-950">
                <strong>Examiner Moderation Note:</strong> {report.reviewNotes}
              </div>
            )}

            {report.aiFeedback.length === 0 ? (
              <p className="text-sm text-slate-500">
                This examination consisted solely of objective auto-scored Listening/Reading modules.
              </p>
            ) : (
              <div className="space-y-4">
                {report.aiFeedback.map((fb) => (
                  <div
                    key={fb.id}
                    className="border border-slate-200 rounded-xl p-5 bg-white space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#0B1F3A]">{fb.skill} Evaluation</h3>
                      <span className="text-xs font-medium text-slate-500 capitalize">
                        Status: {fb.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{fb.rawSummary}</p>

                    {fb.status === 'completed' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
                        {fb.strengths.length > 0 && (
                          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3">
                            <div className="font-bold text-emerald-900 mb-1">Strengths</div>
                            <ul className="list-disc pl-4 space-y-1 text-emerald-900">
                              {fb.strengths.map((s) => (
                                <li key={s}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {fb.weaknesses.length > 0 && (
                          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3">
                            <div className="font-bold text-amber-900 mb-1">Targeted Weaknesses</div>
                            <ul className="list-disc pl-4 space-y-1 text-amber-900">
                              {fb.weaknesses.map((w) => (
                                <li key={w}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {fb.grammarIssues.length > 0 && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <div className="font-bold text-[#0B1F3A] mb-1">Grammar Observations</div>
                            <ul className="list-disc pl-4 space-y-1 text-slate-700">
                              {fb.grammarIssues.map((g) => (
                                <li key={g}>{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {fb.recommendations.length > 0 && (
                          <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3">
                            <div className="font-bold text-[#0B1F3A] mb-1">Action Plan</div>
                            <ul className="list-disc pl-4 space-y-1 text-slate-700">
                              {fb.recommendations.map((rec) => (
                                <li key={rec}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#1D4ED8]" />
                <span>Verification Code: {report.verificationCode}</span>
              </span>
              <span>Scan QR code to validate report authenticity</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
