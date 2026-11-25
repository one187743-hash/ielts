import { GoogleGenAI, Type } from '@google/genai';
import fs from 'node:fs';
import type { CriteriaScore, ExamFamily, SkillName } from '../src/lib/types';

export const AI_MODEL_VERSION = 'gemini-4-hydrogen';

export interface AiAssessmentOutput {
  status: 'completed' | 'unavailable';
  modelVersion: string | null;
  estimatedScore: number | null;
  criteriaScores: CriteriaScore[];
  grammarIssues: string[];
  vocabularyNotes: string;
  coherenceNotes: string;
  fluencyNotes: string;
  pronunciationNotes: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  rawSummary: string;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function transcribeAudioWithGemini(
  filePath: string,
  mimeType: string
): Promise<string | null> {
  const ai = getGeminiClient();
  if (!ai) return null;
  try {
    const audioBytes = fs.readFileSync(filePath).toString('base64');
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: audioBytes,
            },
          },
          {
            text: 'Transcribe the spoken English audio verbatim without adding commentary.',
          },
        ],
      },
    });
    return response.text?.trim() || null;
  } catch (err) {
    console.error('Gemini audio transcription failed:', err);
    return null;
  }
}

export async function assessResponseWithGemini(params: {
  examFamily: ExamFamily;
  skill: SkillName;
  prompt: string;
  responseText: string;
  wordCount: number;
}): Promise<AiAssessmentOutput> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      status: 'unavailable',
      modelVersion: null,
      estimatedScore: null,
      criteriaScores: [],
      grammarIssues: [],
      vocabularyNotes: '',
      coherenceNotes: '',
      fluencyNotes: '',
      pronunciationNotes: '',
      strengths: [],
      weaknesses: [],
      recommendations: [],
      rawSummary:
        'Automated AI assessment is currently unavailable (AI service key not configured). This response has been queued for manual examiner review.',
    };
  }

  const maxScore =
    params.examFamily === 'IELTS_ACADEMIC' || params.examFamily === 'IELTS_GENERAL'
      ? 9
      : params.examFamily === 'PTE_ACADEMIC'
        ? 90
        : params.examFamily === 'TOEFL_IBT'
          ? 30
          : 100;

  const rubricGuide =
    params.examFamily.startsWith('IELTS') && params.skill === 'Writing'
      ? 'Use the 4 official IELTS Writing criteria: Task Achievement/Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy (each scored 0-9 in 0.5 increments).'
      : params.examFamily.startsWith('IELTS') && params.skill === 'Speaking'
        ? 'Use the 4 official IELTS Speaking criteria: Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation (each scored 0-9 in 0.5 increments; note pronunciation conservatively when evaluating from transcript).'
        : params.examFamily === 'PTE_ACADEMIC'
          ? 'Score on the PTE 10-90 scale with criteria for Content, Form & Structure, Vocabulary, and Grammar/Coherence.'
          : params.examFamily === 'TOEFL_IBT'
            ? 'Score on the TOEFL iBT 0-30 skill scale with criteria for Task Fulfillment, Organization & Coherence, Language Use, and Vocabulary Range.'
            : 'Score on a 0-100 General English scale across Accuracy, Range, Coherence, and Task Completion.';

  try {
    const response = await ai.models.generateContent({
      model: AI_MODEL_VERSION,
      contents: `Evaluate this ${params.examFamily} ${params.skill} response.
Task Prompt: ${params.prompt}
Candidate Response (${params.wordCount} words):
${params.responseText || '[No written or transcribed response submitted]'}

Rubric Rules: ${rubricGuide}
Be fair, constructive, accurate, and conservative if the response is very short or off-topic. Never claim this is an official IELTS/PTE/TOEFL score.`,
      config: {
        systemInstruction:
          'You are a senior English language testing assessor for Meridian Assessment. Provide structured, transparent rubric-based evaluations.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedScore: { type: Type.NUMBER },
            criteriaScores: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  maxScore: { type: Type.NUMBER },
                  comment: { type: Type.STRING },
                },
              },
            },
            grammarIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
            vocabularyNotes: { type: Type.STRING },
            coherenceNotes: { type: Type.STRING },
            fluencyNotes: { type: Type.STRING },
            pronunciationNotes: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            rawSummary: { type: Type.STRING },
          },
        },
      },
    });

    const raw = (response.text ?? '{}').trim();
    const parsed = JSON.parse(raw) as Partial<AiAssessmentOutput>;
    const clampedScore = Math.max(
      0,
      Math.min(maxScore, Number(parsed.estimatedScore ?? 0))
    );

    return {
      status: 'completed',
      modelVersion: AI_MODEL_VERSION,
      estimatedScore: clampedScore,
      criteriaScores: Array.isArray(parsed.criteriaScores) ? parsed.criteriaScores : [],
      grammarIssues: Array.isArray(parsed.grammarIssues) ? parsed.grammarIssues : [],
      vocabularyNotes: parsed.vocabularyNotes || '',
      coherenceNotes: parsed.coherenceNotes || '',
      fluencyNotes: parsed.fluencyNotes || '',
      pronunciationNotes: parsed.pronunciationNotes || '',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      rawSummary: parsed.rawSummary || 'AI rubric evaluation completed.',
    };
  } catch (err) {
    console.error('Gemini assessment error:', err);
    return {
      status: 'unavailable',
      modelVersion: null,
      estimatedScore: null,
      criteriaScores: [],
      grammarIssues: [],
      vocabularyNotes: '',
      coherenceNotes: '',
      fluencyNotes: '',
      pronunciationNotes: '',
      strengths: [],
      weaknesses: [],
      recommendations: [],
      rawSummary:
        'Automated AI assessment could not be completed at this time. This attempt is queued for examiner review.',
    };
  }
}
