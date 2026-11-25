import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOverallScore,
  computeRemainingSeconds,
  countWords,
  formatTimerSeconds,
  gradeObjectiveAnswer,
  mapCefrLevel,
  rawRatioToIeltsBand,
  rawRatioToPteScore,
  roundIeltsBand,
} from './scoring';

test('countWords accurately counts prose tokens and handles empty strings', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   ...   '), 0);
  assert.equal(countWords('Academic writing requires clear coherence and lexical precision.'), 8);
});

test('roundIeltsBand follows official nearest-0.5 band rounding', () => {
  assert.equal(roundIeltsBand(6.25), 6.5);
  assert.equal(roundIeltsBand(6.75), 7.0);
  assert.equal(roundIeltsBand(6.125), 6.0);
  assert.equal(roundIeltsBand(6.625), 6.5);
  assert.equal(roundIeltsBand(9.5), 9.0);
});

test('rawRatioToIeltsBand and rawRatioToPteScore scale proportions accurately', () => {
  assert.equal(rawRatioToIeltsBand(40, 40), 9.0);
  assert.equal(rawRatioToIeltsBand(20, 40), 5.5);
  assert.equal(rawRatioToPteScore(10, 10), 90);
  assert.equal(rawRatioToPteScore(0, 10), 10);
});

test('gradeObjectiveAnswer grades MCQ, TFNG, completion, reorder, and dictation accurately', () => {
  assert.equal(gradeObjectiveAnswer('mcq', 'B', 'b', null, 1), 1);
  assert.equal(gradeObjectiveAnswer('tfng', 'NOT GIVEN', 'Not Given', null, 1), 1);
  assert.equal(gradeObjectiveAnswer('completion', 'sustainability|sustainable', null, 'Sustainability.', 1), 1);
  assert.equal(gradeObjectiveAnswer('pte_reorder', ['C', 'A', 'D', 'B'], null, 'C, A, D, B', 3), 3);
  // Partial adjacent credit: C->A (hit), A->B (miss), B->D (miss) => 1/3 * 3 = 1
  assert.equal(gradeObjectiveAnswer('pte_reorder', ['C', 'A', 'D', 'B'], null, 'C, A, B, D', 3), 1);
  // Dictation word-hit scoring
  assert.equal(
    gradeObjectiveAnswer('pte_dictation', 'The library closes at nine', null, 'The library closes at eight', 5),
    4
  );
});

test('computeOverallScore computes IELTS, PTE, TOEFL, and CEFR labels properly', () => {
  const ielts = computeOverallScore('IELTS_ACADEMIC', [
    { skill: 'Listening', score: 7.5 },
    { skill: 'Reading', score: 7.0 },
    { skill: 'Writing', score: 6.5 },
    { skill: 'Speaking', score: 7.0 },
  ]);
  assert.equal(ielts.overallScore, 7.0);
  assert.equal(ielts.overallLabel, 'Band 7.0');
  assert.equal(ielts.cefrLevel, 'C1');

  const toefl = computeOverallScore('TOEFL_IBT', [
    { skill: 'Reading', score: 26 },
    { skill: 'Listening', score: 27 },
    { skill: 'Speaking', score: 24 },
    { skill: 'Writing', score: 25 },
  ]);
  assert.equal(toefl.overallScore, 102);
  assert.equal(toefl.overallLabel, '102 / 120');
  assert.equal(mapCefrLevel('PTE_ACADEMIC', 79), 'C1');
});

test('timer utilities compute non-negative remaining seconds and format cleanly', () => {
  const future = new Date(1_700_000_090_000).toISOString();
  assert.equal(computeRemainingSeconds(future, 1_700_000_000_000), 90);
  assert.equal(computeRemainingSeconds(future, 1_700_000_200_000), 0);
  assert.equal(formatTimerSeconds(3665), '01:01:05');
  assert.equal(formatTimerSeconds(95), '01:35');
});
