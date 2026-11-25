import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  Mic,
  Pause,
  Play,
  Square,
  Volume2,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ExamDiagramGraphic } from '../../components/BrandMark';
import {
  computeRemainingSeconds,
  countWords,
  formatTimerSeconds,
} from '../../lib/scoring';
import type { ExamAttemptPayload, ExamQuestionPublic } from '../../lib/types';

export function ExamEngine({
  attemptId,
  onSubmitted,
  onExitPortal,
}: {
  attemptId: number;
  onSubmitted: (reportId: number) => void;
  onExitPortal: () => void;
}) {
  const [payload, setPayload] = useState<ExamAttemptPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [instructionsAccepted, setInstructionsAccepted] = useState(false);

  const [sectionIdx, setSectionIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<
    Record<
      number,
      {
        answerText: string;
        selectedOptionKey: string;
        audioRecordingId: number | null;
        wordCount: number;
        isFlagged: boolean;
      }
    >
  >({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [remainingSec, setRemainingSec] = useState<number>(3600);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  // Audio playback state (Listening)
  const [speakingAudio, setSpeakingAudio] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Microphone recording state (Speaking)
  const [prepRemaining, setPrepRemaining] = useState(0);
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordSecondsLeft, setRecordSecondsLeft] = useState(0);
  const [micStatus, setMicStatus] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const saveTimeoutsRef = useRef<Record<number, number>>({});
  const dirtyQuestionsRef = useRef<Set<number>>(new Set());
  const inFlightSavesRef = useRef<Map<number, { token: symbol; promise: Promise<void> }>>(new Map());
  const latestAnswersRef = useRef<
    Record<
      number,
      {
        answerText: string;
        selectedOptionKey: string;
        audioRecordingId: number | null;
        wordCount: number;
        isFlagged: boolean;
      }
    >
  >({});
  const flaggedRef = useRef<number[]>([]);
  const sectionIdxRef = useRef<number>(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiFetch<ExamAttemptPayload>(`/api/attempts/${attemptId}`);
        const initialSectionIdx = data.attempt.currentSectionIdx || 0;
        const initialFlagged = data.attempt.flaggedQuestions || [];
        const initialAnswers = data.savedAnswers || {};
        setPayload(data);
        sectionIdxRef.current = initialSectionIdx;
        setSectionIdx(initialSectionIdx);
        flaggedRef.current = initialFlagged;
        setFlagged(initialFlagged);
        latestAnswersRef.current = { ...initialAnswers };
        setAnswers(initialAnswers);
        setRemainingSec(computeRemainingSeconds(data.attempt.expiresAt));
        if (Object.keys(initialAnswers).length > 0) {
          setInstructionsAccepted(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load examination.');
      } finally {
        setLoading(false);
      }
    };
    void load();
    return () => {
      for (const timerId of Object.values(saveTimeoutsRef.current)) {
        window.clearTimeout(timerId);
      }
      saveTimeoutsRef.current = {};
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [attemptId]);

  const handleFinalSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      await flushDirtyAnswers();
      const res = await apiFetch<{ reportId: number }>(`/api/attempts/${attemptId}/submit`, {
        method: 'POST',
      });
      onSubmitted(res.reportId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
      setSubmitting(false);
    }
  };

  // Server-anchored countdown timer + auto-submit on expiry
  useEffect(() => {
    if (!payload || !instructionsAccepted) return;
    const interval = window.setInterval(() => {
      const rem = computeRemainingSeconds(payload.attempt.expiresAt);
      setRemainingSec(rem);
      if (rem <= 0) {
        window.clearInterval(interval);
        void handleFinalSubmit();
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [payload, instructionsAccepted]);

  // Prep timer countdown
  useEffect(() => {
    if (prepRemaining <= 0) return;
    const t = window.setTimeout(() => setPrepRemaining((p) => p - 1), 1000);
    return () => window.clearTimeout(t);
  }, [prepRemaining]);

  // Record timer countdown
  useEffect(() => {
    if (!recordingActive || recordSecondsLeft <= 0) return;
    const t = window.setTimeout(() => {
      if (recordSecondsLeft <= 1) {
        stopRecording();
      } else {
        setRecordSecondsLeft((r) => r - 1);
      }
    }, 1000);
    return () => window.clearTimeout(t);
  }, [recordingActive, recordSecondsLeft]);

  const persistAnswer = (
    questionId: number,
    nextAnswerText: string,
    nextSelectedOption: string,
    nextFlagged: number[],
    nextSecIdx: number
  ): Promise<void> => {
    if (saveTimeoutsRef.current[questionId]) {
      window.clearTimeout(saveTimeoutsRef.current[questionId]);
      delete saveTimeoutsRef.current[questionId];
    }
    dirtyQuestionsRef.current.delete(questionId);
    setSavingState('saving');

    const token = Symbol();
    const savePromise = (async () => {
      try {
        await apiFetch(`/api/attempts/${attemptId}/answer`, {
          method: 'PUT',
          body: JSON.stringify({
            questionId,
            answerText: nextAnswerText,
            selectedOptionKey: nextSelectedOption,
            isFlagged: nextFlagged.includes(questionId),
            currentSectionIdx: nextSecIdx,
            flaggedQuestions: nextFlagged,
          }),
        });
      } catch {
        dirtyQuestionsRef.current.add(questionId);
        setSavingState('idle');
      } finally {
        if (inFlightSavesRef.current.get(questionId)?.token === token) {
          inFlightSavesRef.current.delete(questionId);
        }
        if (
          dirtyQuestionsRef.current.size === 0 &&
          inFlightSavesRef.current.size === 0
        ) {
          setSavingState('saved');
        }
      }
    })();

    inFlightSavesRef.current.set(questionId, { token, promise: savePromise });
    return savePromise;
  };

  const flushDirtyAnswers = async () => {
    for (const [qIdStr, timerId] of Object.entries(saveTimeoutsRef.current)) {
      const qId = Number(qIdStr);
      window.clearTimeout(timerId);
      delete saveTimeoutsRef.current[qId];
      dirtyQuestionsRef.current.add(qId);
    }
    const pendingIds = Array.from(dirtyQuestionsRef.current);
    const pendingPromises = pendingIds.map((qId) => {
      const ans = latestAnswersRef.current[qId];
      if (!ans) return Promise.resolve();
      return persistAnswer(
        qId,
        ans.answerText,
        ans.selectedOptionKey,
        flaggedRef.current,
        sectionIdxRef.current
      );
    });
    const inFlight = Array.from(inFlightSavesRef.current.values()).map((entry) => entry.promise);
    await Promise.all([...pendingPromises, ...inFlight]);
  };

  const updateQuestionAnswer = (
    q: ExamQuestionPublic,
    answerText: string,
    selectedOptionKey: string,
    immediate = false
  ) => {
    const wc = countWords(answerText);
    const nextEntry = {
      answerText,
      selectedOptionKey,
      audioRecordingId: latestAnswersRef.current[q.id]?.audioRecordingId ?? null,
      wordCount: wc,
      isFlagged: flaggedRef.current.includes(q.id),
    };
    latestAnswersRef.current = {
      ...latestAnswersRef.current,
      [q.id]: nextEntry,
    };
    setAnswers((prev) => ({
      ...prev,
      [q.id]: {
        ...nextEntry,
        audioRecordingId: prev[q.id]?.audioRecordingId ?? nextEntry.audioRecordingId,
      },
    }));

    if (saveTimeoutsRef.current[q.id]) {
      window.clearTimeout(saveTimeoutsRef.current[q.id]);
      delete saveTimeoutsRef.current[q.id];
    }

    if (immediate) {
      void persistAnswer(
        q.id,
        answerText,
        selectedOptionKey,
        flaggedRef.current,
        sectionIdxRef.current
      );
    } else {
      dirtyQuestionsRef.current.add(q.id);
      setSavingState('saving');
      saveTimeoutsRef.current[q.id] = window.setTimeout(() => {
        delete saveTimeoutsRef.current[q.id];
        const latest = latestAnswersRef.current[q.id];
        if (latest) {
          void persistAnswer(
            q.id,
            latest.answerText,
            latest.selectedOptionKey,
            flaggedRef.current,
            sectionIdxRef.current
          );
        }
      }, 250);
    }
  };

  const toggleFlag = (qId: number) => {
    const nextFlagged = flaggedRef.current.includes(qId)
      ? flaggedRef.current.filter((id) => id !== qId)
      : [...flaggedRef.current, qId];
    flaggedRef.current = nextFlagged;
    setFlagged(nextFlagged);
    const cur = latestAnswersRef.current[qId];
    void persistAnswer(
      qId,
      cur?.answerText || '',
      cur?.selectedOptionKey || '',
      nextFlagged,
      sectionIdxRef.current
    );
  };

  const playAudioScript = (script: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setShowTranscript(true);
      return;
    }
    if (speakingAudio) {
      window.speechSynthesis.cancel();
      setSpeakingAudio(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(script);
    utter.rate = 0.96;
    utter.onend = () => setSpeakingAudio(false);
    utter.onerror = () => setSpeakingAudio(false);
    setSpeakingAudio(true);
    window.speechSynthesis.speak(utter);
  };

  const startRecording = async (q: ExamQuestionPublic) => {
    setMicStatus('');
    setRecordedBlobUrl(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('Microphone API unavailable in this browser. Type your spoken transcript below.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = String(reader.result || '');
          try {
            const curText = answers[q.id]?.answerText || '';
            const up = await apiFetch<{ recordingId: number; transcript: string }>(
              `/api/attempts/${attemptId}/recordings`,
              {
                method: 'POST',
                body: JSON.stringify({
                  questionId: q.id,
                  mimeType: blob.type || 'audio/webm',
                  durationSeconds: Math.max(1, (q.recordSeconds || 60) - recordSecondsLeft),
                  audioBase64: base64,
                  clientTranscript: curText,
                }),
              }
            );
            const updatedEntry = {
              answerText: up.transcript || curText,
              selectedOptionKey: '',
              audioRecordingId: up.recordingId,
              wordCount: countWords(up.transcript || curText),
              isFlagged: flaggedRef.current.includes(q.id),
            };
            latestAnswersRef.current = {
              ...latestAnswersRef.current,
              [q.id]: updatedEntry,
            };
            setAnswers((prev) => ({
              ...prev,
              [q.id]: updatedEntry,
            }));
            setMicStatus('Audio uploaded securely.');
          } catch {
            setMicStatus('Recording saved locally; enter or verify transcript text below.');
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingActive(true);
      setRecordSecondsLeft(q.recordSeconds || 60);
    } catch {
      setMicStatus(
        'No microphone permission or hardware detected. Enter your spoken response transcript below to continue.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecordingActive(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-sm text-slate-600">
        Loading examination environment...
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-6 space-y-4">
        <div className="text-red-700 font-semibold">{error || 'Examination unavailable.'}</div>
        <button
          type="button"
          onClick={onExitPortal}
          className="px-4 py-2 text-sm font-semibold text-white bg-[#0B1F3A] rounded-lg"
        >
          Return to Portal
        </button>
      </div>
    );
  }

  const allQuestions = payload.sections.flatMap((s) => s.questions);
  const answeredCount = allQuestions.filter((q) => {
    const a = answers[q.id];
    return Boolean(a && (a.selectedOptionKey.trim() || a.answerText.trim() || a.audioRecordingId));
  }).length;

  // Pre-flight instructions screen
  if (!instructionsAccepted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">
              {payload.attempt.examFamily.replace('_', ' ')} · Attempt #{payload.attempt.attemptNumber}
            </div>
            <h1 className="text-2xl font-extrabold text-[#0B1F3A] mt-1">
              {payload.attempt.examTitle}
            </h1>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-2.5 text-sm text-slate-700">
            <h2 className="font-bold text-[#0B1F3A]">Candidate Instructions</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Total Sections: {payload.sections.length} ({payload.sections.map((s) => s.skill).join(', ')})
              </li>
              <li>
                Total Questions: {allQuestions.length} · Remaining Time:{' '}
                <span className="font-mono-tabular font-semibold">{formatTimerSeconds(remainingSec)}</span>
              </li>
              <li>
                Answers autosave continuously to the server. If your browser reloads, reopen the exam
                to resume with your saved progress.
              </li>
              <li>
                When the timer reaches 00:00, your attempt is submitted automatically.
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onExitPortal}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Return to Library
            </button>
            <button
              type="button"
              onClick={() => setInstructionsAccepted(true)}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg"
            >
              Begin Timed Examination
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentSection = payload.sections[sectionIdx] || payload.sections[0];
  const currentQuestion =
    currentSection.questions[questionIdx] || currentSection.questions[0];
  const currentAns = answers[currentQuestion?.id] || {
    answerText: '',
    selectedOptionKey: '',
    audioRecordingId: null,
    wordCount: 0,
    isFlagged: false,
  };
  const isSubjectiveText = currentQuestion
    ? [
        'writing_task1',
        'writing_task2',
        'writing_essay',
        'writing_summary',
        'pte_summarize_spoken',
        'toefl_writing',
      ].includes(currentQuestion.questionType)
    : false;
  const isSpeaking = currentQuestion
    ? [
        'speaking_part1',
        'speaking_part2',
        'speaking_part3',
        'pte_read_aloud',
        'pte_repeat_sentence',
        'pte_describe_image',
        'pte_retell_lecture',
        'toefl_speaking',
      ].includes(currentQuestion.questionType)
    : false;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Exam Header */}
      <header className="sticky top-0 z-30 bg-[#0B1F3A] text-white px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{payload.attempt.examTitle}</div>
          <div className="text-xs text-slate-300 tabular-nums">
            Progress: {answeredCount} / {allQuestions.length} answered ·{' '}
            {savingState === 'saving'
              ? 'Saving...'
              : savingState === 'saved'
                ? 'Autosaved'
                : 'Ready'}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono-tabular text-sm font-bold ${
              remainingSec < 300 ? 'bg-red-600 text-white' : 'bg-[#132D52] text-blue-100'
            }`}
            aria-label="Remaining time"
          >
            <Clock className="w-4 h-4" />
            <span>{formatTimerSeconds(remainingSec)}</span>
          </div>
          <button
            type="button"
            onClick={() => setConfirmSubmitOpen(true)}
            className="px-4 py-2 text-xs font-semibold bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg whitespace-nowrap"
          >
            Submit Exam
          </button>
        </div>
      </header>

      {/* Section Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto">
        {payload.sections.map((sec, idx) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => {
              sectionIdxRef.current = idx;
              setSectionIdx(idx);
              setQuestionIdx(0);
              setRecordedBlobUrl(null);
              setMicStatus('');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              sectionIdx === idx
                ? 'bg-[#0B1F3A] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {idx + 1}. {sec.skill} ({sec.questions.length})
          </button>
        ))}
      </div>

      {error && (
        <div className="max-w-7xl mx-auto w-full px-4 pt-4">
          <div className="border border-red-200 bg-red-50 text-red-900 rounded-lg p-3 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Main Split Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Passage / Audio / Context */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">
              {currentSection.skill} Section
            </div>
            <h2 className="text-lg font-bold text-[#0B1F3A] mt-0.5">{currentSection.title}</h2>
            <p className="text-xs text-slate-600 mt-1">{currentSection.instructions}</p>
          </div>

          {currentSection.audioScript && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0B1F3A] flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Listening Audio Briefing</span>
                </span>
                <button
                  type="button"
                  onClick={() => playAudioScript(currentSection.audioScript!)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg"
                >
                  {speakingAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{speakingAudio ? 'Stop Audio' : 'Play Audio'}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowTranscript(!showTranscript)}
                className="text-xs text-[#1D4ED8] hover:underline"
              >
                {showTranscript ? 'Hide Transcript' : 'Show Transcript (Accessibility / Review)'}
              </button>
              {showTranscript && (
                <p className="text-xs text-slate-700 leading-relaxed bg-white border border-slate-200 rounded p-3">
                  {currentSection.audioScript}
                </p>
              )}
            </div>
          )}

          {currentSection.passageText && (
            <div className="border-t border-slate-100 pt-4 space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {currentSection.passageTitle && (
                <h3 className="text-base font-bold text-[#0B1F3A]">{currentSection.passageTitle}</h3>
              )}
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {currentSection.passageText}
              </div>
            </div>
          )}

          {!currentSection.passageText && !currentSection.audioScript && (
            <div className="text-xs text-slate-500 border-t border-slate-100 pt-4">
              Review the task prompt and timing requirements on the right panel carefully before
              composing or recording your response.
            </div>
          )}
        </div>

        {/* Right Pane: Active Question + Navigator */}
        <div className="lg:col-span-7 space-y-5">
          {currentQuestion && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-mono-tabular text-slate-500">
                    Question {questionIdx + 1} of {currentSection.questions.length} · Max Marks:{' '}
                    {currentQuestion.maxMarks}
                  </div>
                  <h3 className="text-base font-bold text-[#0B1F3A] mt-1 leading-snug">
                    {currentQuestion.prompt}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border shrink-0 ${
                    flagged.includes(currentQuestion.id)
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{flagged.includes(currentQuestion.id) ? 'Flagged' : 'Flag'}</span>
                </button>
              </div>

              {currentQuestion.contextText && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm text-slate-700 whitespace-pre-line">
                  {currentQuestion.contextText}
                </div>
              )}

              {currentQuestion.imageUrl?.startsWith('svg:') && (
                <ExamDiagramGraphic kind={currentQuestion.imageUrl} />
              )}

              {/* Option-based Questions */}
              {currentQuestion.options.length > 0 && (
                <div className="space-y-2.5">
                  {currentQuestion.options.map((opt) => {
                    const selected = currentAns.selectedOptionKey === opt.optionKey;
                    return (
                      <button
                        key={opt.optionKey}
                        type="button"
                        onClick={() =>
                          updateQuestionAnswer(currentQuestion, opt.optionKey, opt.optionKey, true)
                        }
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm flex items-start gap-3 transition-colors ${
                          selected
                            ? 'border-[#1D4ED8] bg-blue-50 text-[#0B1F3A] font-semibold'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="font-mono-tabular font-bold shrink-0">{opt.optionKey}.</span>
                        <span>{opt.optionText}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Short Completion / Reorder / Dictation Input */}
              {currentQuestion.options.length === 0 && !isSubjectiveText && !isSpeaking && (
                <div>
                  <label
                    htmlFor={`q-input-${currentQuestion.id}`}
                    className="block text-xs font-medium text-slate-600 mb-1.5"
                  >
                    Your Answer
                  </label>
                  <input
                    id={`q-input-${currentQuestion.id}`}
                    type="text"
                    value={currentAns.answerText}
                    onChange={(e) =>
                      updateQuestionAnswer(currentQuestion, e.target.value, '')
                    }
                    placeholder="Type your exact response here..."
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>
              )}

              {/* Writing Editor */}
              {isSubjectiveText && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <label htmlFor={`writing-${currentQuestion.id}`} className="font-medium">
                      Written Response Editor
                    </label>
                    <span className="font-mono-tabular font-semibold text-[#0B1F3A]">
                      Word Count: {countWords(currentAns.answerText)}
                    </span>
                  </div>
                  <textarea
                    id={`writing-${currentQuestion.id}`}
                    rows={11}
                    value={currentAns.answerText}
                    onChange={(e) =>
                      updateQuestionAnswer(currentQuestion, e.target.value, '')
                    }
                    placeholder="Compose your response clearly using formal academic structure..."
                    className="w-full p-4 border border-slate-300 rounded-lg text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>
              )}

              {/* Speaking Recorder + Transcript */}
              {isSpeaking && (
                <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 font-mono-tabular">
                      Prep: {currentQuestion.prepSeconds || 15}s · Max Record:{' '}
                      {currentQuestion.recordSeconds || 60}s
                      {prepRemaining > 0 && (
                        <span className="ml-2 font-bold text-[#1D4ED8]">
                          Prep countdown: {prepRemaining}s
                        </span>
                      )}
                      {recordingActive && (
                        <span className="ml-2 font-bold text-red-600">
                          Recording: {recordSecondsLeft}s
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {currentQuestion.prepSeconds > 0 && prepRemaining === 0 && !recordingActive && (
                        <button
                          type="button"
                          onClick={() => setPrepRemaining(currentQuestion.prepSeconds)}
                          className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                        >
                          Start Prep Timer
                        </button>
                      )}
                      {!recordingActive ? (
                        <button
                          type="button"
                          onClick={() => void startRecording(currentQuestion)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>Record Audio</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg"
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>Stop Recording</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {recordedBlobUrl && (
                    <audio controls src={recordedBlobUrl} className="w-full h-9" />
                  )}
                  {micStatus && <div className="text-xs text-slate-600">{micStatus}</div>}

                  <div>
                    <label
                      htmlFor={`speak-trans-${currentQuestion.id}`}
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Spoken Transcript (Auto-populated when audio transcribes, or type response for text evaluation)
                    </label>
                    <textarea
                      id={`speak-trans-${currentQuestion.id}`}
                      rows={4}
                      value={currentAns.answerText}
                      onChange={(e) =>
                        updateQuestionAnswer(currentQuestion, e.target.value, '')
                      }
                      placeholder="Your spoken response transcript..."
                      className="w-full p-3 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Question Navigation Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={questionIdx === 0 && sectionIdx === 0}
                  onClick={() => {
                    if (questionIdx > 0) {
                      setQuestionIdx(questionIdx - 1);
                    } else if (sectionIdx > 0) {
                      const prevSec = payload.sections[sectionIdx - 1];
                      sectionIdxRef.current = sectionIdx - 1;
                      setSectionIdx(sectionIdx - 1);
                      setQuestionIdx(Math.max(0, prevSec.questions.length - 1));
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg text-slate-700 disabled:opacity-40"
                >
                  Previous Question
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (questionIdx < currentSection.questions.length - 1) {
                      setQuestionIdx(questionIdx + 1);
                    } else if (sectionIdx < payload.sections.length - 1) {
                      sectionIdxRef.current = sectionIdx + 1;
                      setSectionIdx(sectionIdx + 1);
                      setQuestionIdx(0);
                    } else {
                      setConfirmSubmitOpen(true);
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0B1F3A] hover:bg-[#132D52] rounded-lg"
                >
                  {questionIdx === currentSection.questions.length - 1 &&
                  sectionIdx === payload.sections.length - 1
                    ? 'Finish & Review'
                    : 'Next Question'}
                </button>
              </div>
            </div>
          )}

          {/* Question Palette Navigator */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="text-xs font-semibold text-slate-600">
              Section Question Navigator
            </div>
            <div className="flex flex-wrap gap-2">
              {currentSection.questions.map((q, idx) => {
                const a = answers[q.id];
                const isAnswered = Boolean(
                  a && (a.selectedOptionKey.trim() || a.answerText.trim() || a.audioRecordingId)
                );
                const isFlag = flagged.includes(q.id);
                const isCurrent = idx === questionIdx;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setQuestionIdx(idx)}
                    className={`w-9 h-9 rounded-lg text-xs font-mono-tabular font-bold border transition-colors ${
                      isCurrent
                        ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                        : isFlag
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : isAnswered
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Submission Confirmation Modal */}
      {confirmSubmitOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-[#0B1F3A] font-bold text-lg">
              {answeredCount < allQuestions.length ? (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
              <span>Confirm Examination Submission</span>
            </div>
            <div className="text-sm text-slate-600 space-y-1 tabular-nums">
              <div>
                Answered Questions: <strong>{answeredCount}</strong> of {allQuestions.length}
              </div>
              <div>
                Flagged for Review: <strong>{flagged.length}</strong>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Submitting finalizes your responses, computes objective scores, and triggers AI rubric
              evaluation (where included in your plan).
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmSubmitOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
              >
                Continue Testing
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleFinalSubmit()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg disabled:opacity-60"
              >
                {submitting ? 'Processing Assessment...' : 'Submit & Process Results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
