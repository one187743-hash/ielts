export type UserRole = 'student' | 'admin' | 'institution_admin';

export type ExamFamily =
  | 'IELTS_ACADEMIC'
  | 'IELTS_GENERAL'
  | 'PTE_ACADEMIC'
  | 'TOEFL_IBT'
  | 'GENERAL_ENGLISH';

export type SkillName = 'Listening' | 'Reading' | 'Writing' | 'Speaking';

export type AccessTier = 'FREE' | 'BASIC' | 'PREMIUM' | 'INSTITUTIONAL';

export type QuestionType =
  | 'mcq'
  | 'tfng'
  | 'ynng'
  | 'matching'
  | 'completion'
  | 'map_labelling'
  | 'writing_task1'
  | 'writing_task2'
  | 'writing_essay'
  | 'writing_summary'
  | 'speaking_part1'
  | 'speaking_part2'
  | 'speaking_part3'
  | 'pte_read_aloud'
  | 'pte_repeat_sentence'
  | 'pte_describe_image'
  | 'pte_retell_lecture'
  | 'pte_short_question'
  | 'pte_rw_blanks'
  | 'pte_reorder'
  | 'pte_listening_blanks'
  | 'pte_summarize_spoken'
  | 'pte_dictation'
  | 'toefl_speaking'
  | 'toefl_writing';

export type ReportStatus = 'pending' | 'completed' | 'reviewed' | 'invalidated';

export interface UserSession {
  id: number;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  status: string;
  fullName: string;
  planCode: AccessTier;
  planName: string;
}

export interface StudentProfile {
  userId: number;
  email: string;
  emailVerified: boolean;
  fullName: string;
  phone: string | null;
  country: string;
  city: string | null;
  dateOfBirth: string | null;
  educationLevel: string;
  preferredExam: ExamFamily;
  targetScore: string;
  intendedExamDate: string | null;
  objective: string;
  privacyConsent: boolean;
  planCode: AccessTier;
  planName: string;
  subscriptionStatus: string;
  expiresAt: string | null;
  attemptsUsed: number;
  maxMonthlyAttempts: number;
  aiAssessmentEnabled: boolean;
  pdfReportsEnabled: boolean;
}

export interface ExamSummary {
  id: number;
  slug: string;
  title: string;
  examFamily: ExamFamily;
  category: 'Full Mock' | 'Mini Mock' | 'Skill Practice';
  primarySkill: 'All' | SkillName;
  difficulty: 'Foundation' | 'Intermediate' | 'Advanced';
  durationMinutes: number;
  accessTier: AccessTier;
  published: boolean;
  questionCount: number;
  attemptedCount: number;
  lastAttemptStatus?: string | null;
  lastScoreLabel?: string | null;
}

export interface QuestionOptionPublic {
  optionKey: string;
  optionText: string;
}

export interface ExamQuestionPublic {
  id: number;
  sectionId: number;
  questionOrder: number;
  questionType: QuestionType;
  prompt: string;
  contextText: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  prepSeconds: number;
  recordSeconds: number;
  maxMarks: number;
  options: QuestionOptionPublic[];
}

export interface ExamSectionPublic {
  id: number;
  examId: number;
  title: string;
  skill: SkillName;
  sectionOrder: number;
  durationMinutes: number;
  instructions: string;
  passageTitle: string | null;
  passageText: string | null;
  audioScript: string | null;
  audioUrl: string | null;
  questions: ExamQuestionPublic[];
}

export interface ExamAttemptPayload {
  attempt: {
    id: number;
    examId: number;
    examTitle: string;
    examFamily: ExamFamily;
    category: string;
    attemptNumber: number;
    status: string;
    startedAt: string;
    expiresAt: string;
    submittedAt: string | null;
    currentSectionIdx: number;
    flaggedQuestions: number[];
  };
  sections: ExamSectionPublic[];
  savedAnswers: Record<
    number,
    {
      answerText: string;
      selectedOptionKey: string;
      audioRecordingId: number | null;
      wordCount: number;
      isFlagged: boolean;
    }
  >;
}

export interface CriteriaScore {
  name: string;
  score: number;
  maxScore: number;
  comment: string;
}

export interface SkillScoreRecord {
  skill: SkillName;
  score: number;
  maxScore: number;
  label: string;
  criteria: CriteriaScore[];
}

export interface AiFeedbackRecord {
  id: number;
  skill: SkillName;
  questionId: number | null;
  status: 'completed' | 'unavailable' | 'pending_review';
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

export interface ResultReportDetail {
  reportId: number;
  resultId: number;
  attemptId: number;
  candidateName: string;
  candidateRef: string;
  reportRef: string;
  verificationCode: string;
  examTitle: string;
  examFamily: ExamFamily;
  examDate: string;
  attemptNumber: number;
  overallScore: number;
  overallLabel: string;
  cefrLevel: string;
  status: ReportStatus;
  aiModelVersion: string | null;
  reviewNotes: string | null;
  skillScores: SkillScoreRecord[];
  aiFeedback: AiFeedbackRecord[];
  disclaimer: string;
}

export interface StudyResource {
  id: number;
  slug: string;
  title: string;
  examFamily: string;
  skill: string;
  resourceType: 'Article' | 'Guide' | 'FAQ' | 'Banner';
  summary: string;
  content: string;
  published: boolean;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: number;
  code: AccessTier;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  durationDays: number;
  maxMonthlyAttempts: number;
  aiAssessmentEnabled: boolean;
  pdfReportsEnabled: boolean;
  features: string[];
  discountPercent: number;
  active: boolean;
}
