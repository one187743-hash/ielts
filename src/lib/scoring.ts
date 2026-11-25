import type { ExamFamily, QuestionType, SkillName } from './types';

export function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter((token) => /[a-zA-Z0-9]/.test(token)).length;
}

/**
 * Official IELTS Band rounding: rounds to the nearest 0.5 band.
 * .25 rounds up to .5, .75 rounds up to next whole band.
 */
export function roundIeltsBand(rawMean: number): number {
  const clamped = Math.max(0, Math.min(9, rawMean));
  return Math.round(clamped * 2) / 2;
}

/**
 * Converts a raw proportion (0..1) of objective IELTS Listening/Reading marks
 * into an approximate IELTS band between 1.0 and 9.0.
 */
export function rawRatioToIeltsBand(correctMarks: number, totalMarks: number): number {
  if (totalMarks <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, correctMarks / totalMarks));
  const raw = 2.0 + ratio * 7.0;
  return roundIeltsBand(raw);
}

/**
 * PTE Academic scale ranges from 10 to 90.
 */
export function rawRatioToPteScore(correctMarks: number, totalMarks: number): number {
  if (totalMarks <= 0) return 10;
  const ratio = Math.max(0, Math.min(1, correctMarks / totalMarks));
  return Math.round(10 + ratio * 80);
}

/**
 * TOEFL iBT skill scale ranges from 0 to 30; total is 0 to 120.
 */
export function rawRatioToToeflSectionScore(correctMarks: number, totalMarks: number): number {
  if (totalMarks <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, correctMarks / totalMarks));
  return Math.round(ratio * 30);
}

export function mapCefrLevel(examFamily: ExamFamily, overallScore: number): string {
  if (examFamily === 'IELTS_ACADEMIC' || examFamily === 'IELTS_GENERAL') {
    if (overallScore >= 8.5) return 'C2';
    if (overallScore >= 7.0) return 'C1';
    if (overallScore >= 5.5) return 'B2';
    if (overallScore >= 4.0) return 'B1';
    return 'A2';
  }
  if (examFamily === 'PTE_ACADEMIC') {
    if (overallScore >= 85) return 'C2';
    if (overallScore >= 76) return 'C1';
    if (overallScore >= 59) return 'B2';
    if (overallScore >= 43) return 'B1';
    return 'A2';
  }
  if (examFamily === 'TOEFL_IBT') {
    if (overallScore >= 110) return 'C2';
    if (overallScore >= 95) return 'C1';
    if (overallScore >= 72) return 'B2';
    if (overallScore >= 42) return 'B1';
    return 'A2';
  }
  // General English 0-100 percentage
  if (overallScore >= 90) return 'C2';
  if (overallScore >= 75) return 'C1';
  if (overallScore >= 60) return 'B2';
  if (overallScore >= 45) return 'B1';
  return 'A2';
}

export function normalizeObjectiveText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"'()]/g, '')
    .replace(/\s+/g, ' ');
}

export function isSubjectiveQuestionType(questionType: QuestionType): boolean {
  return [
    'writing_task1',
    'writing_task2',
    'writing_essay',
    'writing_summary',
    'speaking_part1',
    'speaking_part2',
    'speaking_part3',
    'pte_read_aloud',
    'pte_repeat_sentence',
    'pte_describe_image',
    'pte_retell_lecture',
    'pte_summarize_spoken',
    'toefl_speaking',
    'toefl_writing',
  ].includes(questionType);
}

export function gradeObjectiveAnswer(
  questionType: QuestionType,
  correctAnswerRaw: string | string[] | null,
  studentSelectedOption: string | null | undefined,
  studentText: string | null | undefined,
  maxMarks: number
): number {
  if (!correctAnswerRaw || maxMarks <= 0) return 0;

  if (questionType === 'mcq' || questionType === 'tfng' || questionType === 'ynng' || questionType === 'matching' || questionType === 'map_labelling') {
    const expected = Array.isArray(correctAnswerRaw)
      ? correctAnswerRaw.map(normalizeObjectiveText)
      : [normalizeObjectiveText(String(correctAnswerRaw))];
    const candidate = normalizeObjectiveText(studentSelectedOption || studentText || '');
    return candidate && expected.includes(candidate) ? maxMarks : 0;
  }

  if (questionType === 'pte_reorder') {
    const expectedOrder = Array.isArray(correctAnswerRaw)
      ? correctAnswerRaw.map((s) => s.trim().toUpperCase())
      : String(correctAnswerRaw)
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
    const candidateOrder = (studentText || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (expectedOrder.length < 2 || candidateOrder.length !== expectedOrder.length) return 0;
    // PTE Re-order awards 1 point per correct adjacent pair
    let adjacentMatches = 0;
    const expectedPairs = new Set<string>();
    for (let i = 0; i < expectedOrder.length - 1; i++) {
      expectedPairs.add(`${expectedOrder[i]}->${expectedOrder[i + 1]}`);
    }
    for (let i = 0; i < candidateOrder.length - 1; i++) {
      if (expectedPairs.has(`${candidateOrder[i]}->${candidateOrder[i + 1]}`)) {
        adjacentMatches += 1;
      }
    }
    const maxPairs = expectedOrder.length - 1;
    return Math.round((adjacentMatches / maxPairs) * maxMarks * 100) / 100;
  }

  // Completion / Fill-in-the-blanks / Short question / Dictation
  const candidate = normalizeObjectiveText(studentText || studentSelectedOption || '');
  if (!candidate) return 0;
  const accepted = Array.isArray(correctAnswerRaw)
    ? correctAnswerRaw.map(normalizeObjectiveText)
    : String(correctAnswerRaw)
        .split('|')
        .map(normalizeObjectiveText);

  if (questionType === 'pte_dictation' && accepted.length > 0) {
    const targetWords = accepted[0].split(' ').filter(Boolean);
    const candidateWords = candidate.split(' ').filter(Boolean);
    if (targetWords.length === 0) return 0;
    let hits = 0;
    const pool = [...candidateWords];
    for (const w of targetWords) {
      const idx = pool.indexOf(w);
      if (idx !== -1) {
        hits += 1;
        pool.splice(idx, 1);
      }
    }
    return Math.round((hits / targetWords.length) * maxMarks * 100) / 100;
  }

  return accepted.includes(candidate) ? maxMarks : 0;
}

export function computeOverallScore(
  examFamily: ExamFamily,
  skillScores: Array<{ skill: SkillName; score: number }>
): { overallScore: number; overallLabel: string; cefrLevel: string } {
  if (skillScores.length === 0) {
    return { overallScore: 0, overallLabel: 'Pending', cefrLevel: 'B1' };
  }

  if (examFamily === 'IELTS_ACADEMIC' || examFamily === 'IELTS_GENERAL') {
    const mean = skillScores.reduce((acc, s) => acc + s.score, 0) / skillScores.length;
    const band = roundIeltsBand(mean);
    return {
      overallScore: band,
      overallLabel: `Band ${band.toFixed(1)}`,
      cefrLevel: mapCefrLevel(examFamily, band),
    };
  }

  if (examFamily === 'PTE_ACADEMIC') {
    const mean = Math.round(skillScores.reduce((acc, s) => acc + s.score, 0) / skillScores.length);
    return {
      overallScore: mean,
      overallLabel: `${mean} / 90`,
      cefrLevel: mapCefrLevel(examFamily, mean),
    };
  }

  if (examFamily === 'TOEFL_IBT') {
    const total = Math.min(
      120,
      Math.round(skillScores.reduce((acc, s) => acc + s.score, 0))
    );
    // If single-skill practice, project proportionally only in label
    const maxPossible = skillScores.length * 30;
    return {
      overallScore: total,
      overallLabel: `${total} / ${maxPossible}`,
      cefrLevel: mapCefrLevel(examFamily, skillScores.length === 4 ? total : (total / maxPossible) * 120),
    };
  }

  const avgPct = Math.round(skillScores.reduce((acc, s) => acc + s.score, 0) / skillScores.length);
  return {
    overallScore: avgPct,
    overallLabel: `${avgPct}%`,
    cefrLevel: mapCefrLevel(examFamily, avgPct),
  };
}

export function computeRemainingSeconds(expiresAtIso: string, nowMs = Date.now()): number {
  const expiresMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresMs)) return 0;
  return Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
}

export function formatTimerSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
