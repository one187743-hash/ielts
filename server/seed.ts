import { db } from './db';
import { hashPassword } from './auth';

interface SeedQuestion {
  order: number;
  type: string;
  prompt: string;
  contextText?: string;
  imageUrl?: string;
  prepSeconds?: number;
  recordSeconds?: number;
  maxMarks: number;
  correctAnswer?: string | string[];
  options?: Array<{ key: string; text: string; isCorrect?: boolean }>;
  rubric?: Record<string, unknown>;
}

interface SeedSection {
  title: string;
  skill: 'Listening' | 'Reading' | 'Writing' | 'Speaking';
  order: number;
  durationMinutes: number;
  instructions: string;
  passageTitle?: string;
  passageText?: string;
  audioScript?: string;
  questions: SeedQuestion[];
}

function insertExamWithSections(
  exam: {
    slug: string;
    title: string;
    examFamily: string;
    category: string;
    primarySkill: string;
    difficulty: string;
    durationMinutes: number;
    accessTier: string;
    scoringConfig: Record<string, unknown>;
  },
  sections: SeedSection[]
): number {
  const existing = db.prepare('SELECT id FROM examinations WHERE slug = ?').get(exam.slug) as
    | { id: number }
    | undefined;
  if (existing) return existing.id;

  const examRes = db
    .prepare(
      `INSERT INTO examinations (slug, title, exam_family, category, primary_skill, difficulty, duration_minutes, access_tier, scoring_config_json, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(
      exam.slug,
      exam.title,
      exam.examFamily,
      exam.category,
      exam.primarySkill,
      exam.difficulty,
      exam.durationMinutes,
      exam.accessTier,
      JSON.stringify(exam.scoringConfig)
    );
  const examId = Number(examRes.lastInsertRowid);

  const insertSection = db.prepare(
    `INSERT INTO exam_sections (exam_id, title, skill, section_order, duration_minutes, instructions, passage_title, passage_text, audio_script)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertQuestion = db.prepare(
    `INSERT INTO questions (section_id, question_order, question_type, prompt, context_text, image_url, prep_seconds, record_seconds, max_marks, rubric_json, correct_answer_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertOption = db.prepare(
    `INSERT INTO question_options (question_id, option_key, option_text, is_correct)
     VALUES (?, ?, ?, ?)`
  );

  for (const s of sections) {
    const secRes = insertSection.run(
      examId,
      s.title,
      s.skill,
      s.order,
      s.durationMinutes,
      s.instructions,
      s.passageTitle ?? null,
      s.passageText ?? null,
      s.audioScript ?? null
    );
    const sectionId = Number(secRes.lastInsertRowid);

    for (const q of s.questions) {
      const qRes = insertQuestion.run(
        sectionId,
        q.order,
        q.type,
        q.prompt,
        q.contextText ?? null,
        q.imageUrl ?? null,
        q.prepSeconds ?? 0,
        q.recordSeconds ?? 0,
        q.maxMarks,
        JSON.stringify(q.rubric ?? {}),
        q.correctAnswer !== undefined ? JSON.stringify(q.correctAnswer) : null
      );
      const questionId = Number(qRes.lastInsertRowid);
      if (q.options) {
        for (const opt of q.options) {
          insertOption.run(questionId, opt.key, opt.text, opt.isCorrect ? 1 : 0);
        }
      }
    }
  }

  return examId;
}

export function seedDatabase(): void {
  // 1. Seed Subscription Plans
  const planCount = (db.prepare('SELECT COUNT(*) as c FROM subscription_plans').get() as { c: number }).c;
  if (planCount === 0) {
    const insertPlan = db.prepare(
      `INSERT INTO subscription_plans (code, name, description, price_cents, currency, duration_days, max_monthly_attempts, ai_assessment_enabled, pdf_reports_enabled, features_json, discount_percent, active)
       VALUES (?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, 1)`
    );
    insertPlan.run(
      'FREE',
      'Foundation Free',
      'Diagnostic placement and starter practice modules for new candidates.',
      0,
      365,
      3,
      0,
      0,
      JSON.stringify([
        'Account registration & target-band planner',
        '3 diagnostic & sample tests per month',
        'Objective Listening & Reading auto-scoring',
        'Selected preparation guides & FAQs',
      ]),
      0
    );
    insertPlan.run(
      'BASIC',
      'Standard Practice',
      'Expanded mock library with detailed performance history for self-paced learners.',
      1900,
      30,
      15,
      0,
      1,
      JSON.stringify([
        '15 timed mock & skill examinations monthly',
        'Full IELTS, PTE & TOEFL objective practice',
        'Detailed longitudinal performance history',
        'Downloadable unofficial PDF summaries',
      ]),
      0
    );
    insertPlan.run(
      'PREMIUM',
      'Comprehensive AI & Mock',
      'Complete examination library with AI rubric evaluation and QR-verified reports.',
      3900,
      30,
      60,
      1,
      1,
      JSON.stringify([
        'Unlimited full-length IELTS, PTE & TOEFL mocks (up to 60/mo)',
        'AI-assisted Writing & Speaking rubric scoring',
        'Grammar, coherence, vocabulary & fluency diagnostics',
        'QR-verifiable downloadable PDF reports',
      ]),
      0
    );
    insertPlan.run(
      'INSTITUTIONAL',
      'University & Academy Cohort',
      'Managed seat licensing, cohort benchmarking, and institutional administration.',
      19900,
      90,
      500,
      1,
      1,
      JSON.stringify([
        'Configurable multi-candidate group access',
        'Institutional examiner moderation queue',
        'Cohort score exports & verification registry',
        'Dedicated onboarding support',
      ]),
      10
    );
  }

  // 2. Seed Examinations
  const ieltsExamId = insertExamWithSections(
    {
      slug: 'ielts-academic-full-01',
      title: 'IELTS Academic Full Mock Examination — Series 01',
      examFamily: 'IELTS_ACADEMIC',
      category: 'Full Mock',
      primarySkill: 'All',
      difficulty: 'Intermediate',
      durationMinutes: 165,
      accessTier: 'FREE',
      scoringConfig: { scale: '0-9', step: 0.5, criteriaCount: 4 },
    },
    [
      {
        title: 'Section 1: Listening — University Housing & Research Briefing',
        skill: 'Listening',
        order: 1,
        durationMinutes: 30,
        instructions:
          'Play the audio briefing once. Answer questions 1 to 5 using no more than two words or a number where completion is requested.',
        audioScript:
          'Welcome to the Northgate Postgraduate Orientation Desk. For students booking accommodation in Ashworth Hall, the weekly utility contribution is 48 pounds and covers heating and high-speed broadband. Please submit your residency form by Friday the fourteenth at the Student Registry office on Elmwood Avenue. Turning to the Campus Library map: the Rare Manuscripts Wing is located directly north-east of the Central Courtyard, opposite the Acoustic Media Lab. In the second briefing, Dr. Patel notes that urban green corridors reduce summer street temperatures by up to 3.4 degrees Celsius while improving storm-water retention across dense districts.',
        questions: [
          {
            order: 1,
            type: 'completion',
            prompt: 'Complete the accommodation form: Weekly utility contribution is £ ____.',
            contextText: 'Write a number only.',
            maxMarks: 1,
            correctAnswer: '48',
          },
          {
            order: 2,
            type: 'completion',
            prompt: 'Residency forms must be submitted at the Student Registry on ____ Avenue.',
            contextText: 'Write ONE WORD ONLY.',
            maxMarks: 1,
            correctAnswer: 'Elmwood',
          },
          {
            order: 3,
            type: 'map_labelling',
            prompt:
              'Campus Map Labelling: Where is the Rare Manuscripts Wing located relative to the Central Courtyard?',
            imageUrl: 'svg:campus_map',
            maxMarks: 1,
            correctAnswer: 'B',
            options: [
              { key: 'A', text: 'South-West Wing (Zone A)' },
              { key: 'B', text: 'North-East Wing opposite Acoustic Media Lab (Zone B)', isCorrect: true },
              { key: 'C', text: 'Lower Ground Annex (Zone C)' },
              { key: 'D', text: 'West Pavilion (Zone D)' },
            ],
          },
          {
            order: 4,
            type: 'mcq',
            prompt:
              'According to Dr. Patel, what dual benefit do urban green corridors provide?',
            maxMarks: 1,
            correctAnswer: 'C',
            options: [
              { key: 'A', text: 'Higher retail footfall and cheaper asphalt paving' },
              { key: 'B', text: 'Reduced winter snowfall and automated street lighting' },
              {
                key: 'C',
                text: 'Lower summer street temperatures and improved storm-water retention',
                isCorrect: true,
              },
              { key: 'D', text: 'Lower public transit fares and wider freight lanes' },
            ],
          },
          {
            order: 5,
            type: 'completion',
            prompt: 'Sentence completion: Urban green corridors can lower street temperatures by up to ____ degrees Celsius.',
            maxMarks: 1,
            correctAnswer: '3.4',
          },
        ],
      },
      {
        title: 'Section 2: Academic Reading — Urban Microclimates & Maritime Cartography',
        skill: 'Reading',
        order: 2,
        durationMinutes: 60,
        instructions:
          'Read the two academic excerpts carefully and answer Questions 6 to 10.',
        passageTitle: 'Thermal Equity in Contemporary Cities & Early Oceanic Navigation',
        passageText: `Paragraph A: Modern metropolitan planners increasingly treat urban heat not merely as a meteorological curiosity but as an infrastructure equity challenge. Satellite thermography across fourteen European and Asian cities reveals that neighborhoods with less than twelve percent tree canopy experience afternoon surface temperatures up to six degrees higher than adjacent park-lined districts. Crucially, reflective roofing coatings alone rarely solve pedestrian-level discomfort unless paired with permeable pavements and shaded transit corridors.

Paragraph B: In sixteenth-century maritime cartography, portolan charts transitioned from localized coastal sketches to latitude-calibrated oceanic manuals. While Iberian navigators relied heavily on magnetic compass bearings, early chronometers were not yet reliable enough at sea to fix longitude accurately. Consequently, captains frequently sailed along a known latitude parallel—a method termed "running down the westing"—until sighting familiar headlands, accepting slower voyages in exchange for predictable landfall.`,
        questions: [
          {
            order: 6,
            type: 'tfng',
            prompt:
              'TRUE, FALSE, or NOT GIVEN: Reflective roof coatings by themselves are sufficient to eliminate pedestrian-level heat discomfort.',
            maxMarks: 1,
            correctAnswer: 'FALSE',
            options: [
              { key: 'TRUE', text: 'TRUE' },
              { key: 'FALSE', text: 'FALSE', isCorrect: true },
              { key: 'NOT GIVEN', text: 'NOT GIVEN' },
            ],
          },
          {
            order: 7,
            type: 'tfng',
            prompt:
              'TRUE, FALSE, or NOT GIVEN: All fourteen surveyed cities plan to mandate permeable pavements by 2030.',
            maxMarks: 1,
            correctAnswer: 'NOT GIVEN',
            options: [
              { key: 'TRUE', text: 'TRUE' },
              { key: 'FALSE', text: 'FALSE' },
              { key: 'NOT GIVEN', text: 'NOT GIVEN', isCorrect: true },
            ],
          },
          {
            order: 8,
            type: 'matching',
            prompt: 'Matching Headings: Choose the most accurate heading for Paragraph B.',
            maxMarks: 1,
            correctAnswer: 'ii',
            options: [
              { key: 'i', text: 'i. How satellite imagery transformed modern sea ports' },
              {
                key: 'ii',
                text: 'ii. Compensating for longitude uncertainty in Renaissance sea voyages',
                isCorrect: true,
              },
              { key: 'iii', text: 'iii. Why magnetic compasses failed near tropical coasts' },
            ],
          },
          {
            order: 9,
            type: 'completion',
            prompt:
              'Completion: Districts with under ____ percent tree canopy record significantly higher afternoon temperatures.',
            maxMarks: 1,
            correctAnswer: '12|twelve',
          },
          {
            order: 10,
            type: 'mcq',
            prompt: 'Why did sixteenth-century captains sail along a fixed latitude parallel?',
            maxMarks: 1,
            correctAnswer: 'B',
            options: [
              { key: 'A', text: 'To avoid seasonal trade winds near the equator' },
              {
                key: 'B',
                text: 'Because accurate longitudinal timekeeping at sea was not yet dependable',
                isCorrect: true,
              },
              { key: 'C', text: 'To shorten total voyage distance across open oceans' },
            ],
          },
        ],
      },
      {
        title: 'Section 3: Academic Writing — Task 1 & Task 2',
        skill: 'Writing',
        order: 3,
        durationMinutes: 60,
        instructions:
          'Complete both writing tasks. Task 1 requires at least 150 words; Task 2 carries double weight and requires at least 250 words.',
        questions: [
          {
            order: 11,
            type: 'writing_task1',
            prompt:
              'IELTS Writing Task 1: The chart below shows university postgraduate enrollment across four STEM and Humanities faculties between 2018 and 2024. Summarize the main trends and make comparisons where relevant. Write at least 150 words.',
            imageUrl: 'svg:ielts_task1_chart',
            maxMarks: 9,
            rubric: { minWords: 150, criteria: ['Task Achievement', 'Coherence & Cohesion', 'Lexical Resource', 'Grammatical Range & Accuracy'] },
          },
          {
            order: 12,
            type: 'writing_task2',
            prompt:
              'IELTS Writing Task 2: Many universities now deliver a substantial portion of their degree lectures online rather than in physical lecture halls. To what extent do the advantages of this shift outweigh the disadvantages for international students? Write at least 250 words.',
            maxMarks: 9,
            rubric: { minWords: 250, criteria: ['Task Response', 'Coherence & Cohesion', 'Lexical Resource', 'Grammatical Range & Accuracy'] },
          },
        ],
      },
      {
        title: 'Section 4: Speaking — Parts 1, 2 & 3',
        skill: 'Speaking',
        order: 4,
        durationMinutes: 15,
        instructions:
          'Record your spoken response using your microphone (or provide a spoken transcript if testing in a quiet environment without microphone hardware).',
        questions: [
          {
            order: 13,
            type: 'speaking_part1',
            prompt:
              'Speaking Part 1 (Interview): Tell me about the neighborhood where you currently live or study. What makes it a pleasant or challenging place for students?',
            prepSeconds: 10,
            recordSeconds: 60,
            maxMarks: 9,
          },
          {
            order: 14,
            type: 'speaking_part2',
            prompt:
              'Speaking Part 2 (Long Turn Cue Card): Describe a practical skill or academic habit you learned outside a formal classroom. You should say: what the skill was, how you learned it, why it mattered to your goals, and explain how it helps you today.',
            prepSeconds: 60,
            recordSeconds: 120,
            maxMarks: 9,
          },
          {
            order: 15,
            type: 'speaking_part3',
            prompt:
              'Speaking Part 3 (Discussion): How is self-directed digital learning changing the role of traditional university libraries and mentors?',
            prepSeconds: 15,
            recordSeconds: 75,
            maxMarks: 9,
          },
        ],
      },
    ]
  );

  insertExamWithSections(
    {
      slug: 'ielts-general-training-01',
      title: 'IELTS General Training Practice — Workplace & Civic Literacy',
      examFamily: 'IELTS_GENERAL',
      category: 'Mini Mock',
      primarySkill: 'All',
      difficulty: 'Intermediate',
      durationMinutes: 90,
      accessTier: 'BASIC',
      scoringConfig: { scale: '0-9', step: 0.5 },
    },
    [
      {
        title: 'Reading: Workplace Relocation Notice & Editorial',
        skill: 'Reading',
        order: 1,
        durationMinutes: 40,
        instructions: 'Read the workplace handbook excerpt and answer the questions below.',
        passageTitle: 'Hybrid Working Policy & Regional Transit Stipend',
        passageText:
          'From April, full-time staff at Meridian Logistics may work remotely up to two days per week with line-manager approval. Employees travelling to the central depot by rail remain eligible for an annual season-ticket advance, provided applications are lodged at least fourteen days before renewal. While management expects core collaborative meetings to remain in person on Tuesdays, individual focus tasks may be completed off-site.',
        questions: [
          {
            order: 1,
            type: 'ynng',
            prompt:
              'YES, NO, or NOT GIVEN: Staff must apply for the rail season-ticket advance at least two weeks prior to renewal.',
            maxMarks: 1,
            correctAnswer: 'YES',
            options: [
              { key: 'YES', text: 'YES', isCorrect: true },
              { key: 'NO', text: 'NO' },
              { key: 'NOT GIVEN', text: 'NOT GIVEN' },
            ],
          },
          {
            order: 2,
            type: 'completion',
            prompt: 'Collaborative team meetings are scheduled to take place in person on ____.',
            maxMarks: 1,
            correctAnswer: 'Tuesdays|Tuesday',
          },
        ],
      },
      {
        title: 'Writing: Formal Request Letter & Essay',
        skill: 'Writing',
        order: 2,
        durationMinutes: 50,
        instructions: 'Write a clear, appropriately toned formal letter and a short discursive essay.',
        questions: [
          {
            order: 3,
            type: 'writing_task1',
            prompt:
              'General Training Task 1: You recently attended a professional training seminar hosted by an external institute, but your completion certificate contains a spelling error. Write a formal letter to the Programme Coordinator requesting a corrected certificate.',
            maxMarks: 9,
          },
        ],
      },
    ]
  );

  insertExamWithSections(
    {
      slug: 'pte-academic-full-01',
      title: 'PTE Academic Comprehensive Practice — Integrated Skills',
      examFamily: 'PTE_ACADEMIC',
      category: 'Full Mock',
      primarySkill: 'All',
      difficulty: 'Advanced',
      durationMinutes: 120,
      accessTier: 'PREMIUM',
      scoringConfig: { scale: '10-90' },
    },
    [
      {
        title: 'Part 1: Speaking & Writing',
        skill: 'Speaking',
        order: 1,
        durationMinutes: 54,
        instructions: 'Complete Read Aloud, Repeat Sentence, Describe Image, Retell Lecture, Answer Short Question, Summarize Written Text, and Write Essay.',
        questions: [
          {
            order: 1,
            type: 'pte_read_aloud',
            prompt:
              'Read Aloud: Read the following academic text aloud naturally with clear phrasing and stress.',
            contextText:
              'Coastal wetlands act as natural storm buffers, absorbing tidal surges while filtering agricultural runoff before it reaches open marine ecosystems.',
            prepSeconds: 35,
            recordSeconds: 40,
            maxMarks: 5,
          },
          {
            order: 2,
            type: 'pte_repeat_sentence',
            prompt:
              'Repeat Sentence: Listen to the prompt sentence and repeat it verbatim.',
            contextText: 'Audio prompt: "All laboratory safety checklists must be countersigned prior to evening experiments."',
            prepSeconds: 3,
            recordSeconds: 15,
            maxMarks: 3,
          },
          {
            order: 3,
            type: 'pte_describe_image',
            prompt:
              'Describe Image: Examine the renewable grid capacity chart and summarize the primary trends in 40 seconds.',
            imageUrl: 'svg:ielts_task1_chart',
            prepSeconds: 25,
            recordSeconds: 40,
            maxMarks: 5,
          },
          {
            order: 4,
            type: 'pte_retell_lecture',
            prompt:
              'Retell Lecture: Summarize the key findings from the marine acoustics lecture in your own words.',
            contextText:
              'Lecture excerpt: Marine biologists deployed hydrophones along shipping lanes and discovered that lowering vessel speed by ten percent reduced low-frequency underwater noise by nearly half.',
            prepSeconds: 10,
            recordSeconds: 40,
            maxMarks: 5,
          },
          {
            order: 5,
            type: 'pte_short_question',
            prompt:
              'Answer Short Question: What instrument is traditionally used by meteorologists to measure atmospheric pressure?',
            maxMarks: 1,
            correctAnswer: 'barometer|a barometer',
          },
        ],
      },
      {
        title: 'Part 2: Writing & Reading Integrated',
        skill: 'Reading',
        order: 2,
        durationMinutes: 40,
        instructions: 'Complete Summarize Written Text, Write Essay, Reading & Writing Fill in the Blanks, and Re-order Paragraphs.',
        passageTitle: 'Circadian Architecture in Daylight-Responsive Workplaces',
        passageText:
          'Recent architectural studies show that dynamic glazing systems regulate indoor glare without severing visual connections to natural daylight cycles, supporting steadier occupant alertness across winter afternoons.',
        questions: [
          {
            order: 6,
            type: 'writing_summary',
            prompt:
              'Summarize Written Text: Summarize the passage above in ONE single sentence between 5 and 75 words.',
            maxMarks: 7,
          },
          {
            order: 7,
            type: 'writing_essay',
            prompt:
              'Write Essay (200–300 words): Should public funding prioritize preventative community health clinics over expanding acute hospital capacity? Support your argument with clear reasons.',
            maxMarks: 15,
          },
          {
            order: 8,
            type: 'pte_rw_blanks',
            prompt:
              'Reading & Writing Fill in the Blanks: Empirical evidence ____ that early phonetic exposure accelerates second-language listening comprehension.',
            maxMarks: 1,
            correctAnswer: 'demonstrates',
            options: [
              { key: 'demonstrates', text: 'demonstrates', isCorrect: true },
              { key: 'hesitates', text: 'hesitates' },
              { key: 'postpones', text: 'postpones' },
              { key: 'concludes_to', text: 'concludes to' },
            ],
          },
          {
            order: 9,
            type: 'pte_reorder',
            prompt:
              'Re-order Paragraphs: Enter the correct logical sequence of paragraph keys separated by commas (e.g., B, A, D, C).',
            contextText:
              'A) Consequently, urban transit authorities began electrifying bus depots.\nB) Diesel exhaust historically accounted for a large share of street-level particulates.\nC) Within five years, roadside nitrogen dioxide levels dropped measurably.\nD) Early pilot routes proved that battery buses handled steep gradients reliably.',
            maxMarks: 3,
            correctAnswer: ['B', 'D', 'A', 'C'],
          },
        ],
      },
      {
        title: 'Part 3: Listening — Summarize Spoken Text, Fill in the Blanks & Dictation',
        skill: 'Listening',
        order: 3,
        durationMinutes: 26,
        instructions: 'Listen to the lecture excerpt and complete the final tasks.',
        audioScript:
          'Archaeological dendrochronology allows historians to date medieval timber beams to the exact calendar year by comparing ring-width patterns against regional climate chronologies. For your dictation sentence: Peer review strengthens empirical reliability before publication.',
        questions: [
          {
            order: 10,
            type: 'pte_summarize_spoken',
            prompt: 'Summarize Spoken Text: Write a 50–70 word summary of the dendrochronology audio briefing.',
            maxMarks: 10,
          },
          {
            order: 11,
            type: 'pte_listening_blanks',
            prompt: 'Listening Fill in the Blanks: Dendrochronology dates timber beams by comparing ____ patterns against regional climate chronologies.',
            maxMarks: 1,
            correctAnswer: 'ring-width|ring width',
          },
          {
            order: 12,
            type: 'pte_dictation',
            prompt: 'Write from Dictation: Type the exact final sentence spoken in the audio.',
            maxMarks: 7,
            correctAnswer: 'Peer review strengthens empirical reliability before publication',
          },
        ],
      },
    ]
  );

  insertExamWithSections(
    {
      slug: 'toefl-ibt-full-01',
      title: 'TOEFL iBT Academic Readiness Mock Examination',
      examFamily: 'TOEFL_IBT',
      category: 'Full Mock',
      primarySkill: 'All',
      difficulty: 'Advanced',
      durationMinutes: 116,
      accessTier: 'BASIC',
      scoringConfig: { scale: '0-120', sectionMax: 30 },
    },
    [
      {
        title: 'Reading Section — Bioluminescence in Deep-Sea Ecology',
        skill: 'Reading',
        order: 1,
        durationMinutes: 35,
        instructions: 'Read the passage and select the best response for each question.',
        passageTitle: 'Chemical Light in Mesopelagic Waters',
        passageText:
          'Below two hundred meters, sunlight fades into perpetual twilight, yet biological light thrives. Over seventy percent of observed mesopelagic organisms synthesize luciferin compounds to emit blue-green bioluminescence. Far from serving only as lures for prey, ventral photophores perform counter-illumination—matching the faint intensity of downwelling sunlight so predators gazing upward fail to detect a silhouette.',
        questions: [
          {
            order: 1,
            type: 'mcq',
            prompt: 'What is the primary function of counter-illumination described in the passage?',
            maxMarks: 1,
            correctAnswer: 'B',
            options: [
              { key: 'A', text: 'Attracting mates across deep trenches' },
              { key: 'B', text: 'Concealing an organism’s silhouette from predators below', isCorrect: true },
              { key: 'C', text: 'Generating heat in freezing deep currents' },
            ],
          },
          {
            order: 2,
            type: 'mcq',
            prompt: 'The word "synthesize" in the passage is closest in meaning to:',
            maxMarks: 1,
            correctAnswer: 'A',
            options: [
              { key: 'A', text: 'produce', isCorrect: true },
              { key: 'B', text: 'reflect' },
              { key: 'C', text: 'consume' },
            ],
          },
        ],
      },
      {
        title: 'Listening Section — Campus Seminar on Behavioral Economics',
        skill: 'Listening',
        order: 2,
        durationMinutes: 36,
        instructions: 'Listen to the seminar excerpt and answer the questions.',
        audioScript:
          'Professor Lin: Notice how default enrollment changes retirement participation. When employees must opt in manually, enrollment averages forty-two percent. When enrollment is automatic with an opt-out option, participation climbs above eighty-five percent, demonstrating status-quo bias.',
        questions: [
          {
            order: 3,
            type: 'mcq',
            prompt: 'Why does Professor Lin contrast opt-in and automatic enrollment rates?',
            maxMarks: 1,
            correctAnswer: 'C',
            options: [
              { key: 'A', text: 'To criticize corporate payroll software' },
              { key: 'B', text: 'To show that employees dislike saving for retirement' },
              { key: 'C', text: 'To illustrate the practical impact of status-quo bias', isCorrect: true },
            ],
          },
        ],
      },
      {
        title: 'Speaking Section — Independent & Integrated Tasks',
        skill: 'Speaking',
        order: 3,
        durationMinutes: 16,
        instructions: 'Prepare for 15 seconds and speak clearly for 45 seconds.',
        questions: [
          {
            order: 4,
            type: 'toefl_speaking',
            prompt:
              'TOEFL Independent Speaking: Some universities require all first-year undergraduates to complete an interdisciplinary seminar outside their major. Do you agree or disagree with this policy? Explain with specific reasons.',
            prepSeconds: 15,
            recordSeconds: 45,
            maxMarks: 30,
          },
        ],
      },
      {
        title: 'Writing Section — Writing for an Academic Discussion',
        skill: 'Writing',
        order: 4,
        durationMinutes: 29,
        instructions: 'Read the professor’s question and write a well-supported contribution of at least 120 words.',
        questions: [
          {
            order: 5,
            type: 'toefl_writing',
            prompt:
              'Academic Discussion Prompt: Your environmental policy seminar is debating whether cities should subsidize electric bicycles or expand underground metro lines first. Write a clear post contributing your perspective and reasoning.',
            maxMarks: 30,
          },
        ],
      },
    ]
  );

  insertExamWithSections(
    {
      slug: 'general-english-diagnostic',
      title: 'General English CEFR Diagnostic Assessment (Free)',
      examFamily: 'GENERAL_ENGLISH',
      category: 'Mini Mock',
      primarySkill: 'All',
      difficulty: 'Foundation',
      durationMinutes: 25,
      accessTier: 'FREE',
      scoringConfig: { scale: '0-100' },
    },
    [
      {
        title: 'Listening & Everyday Comprehension',
        skill: 'Listening',
        order: 1,
        durationMinutes: 8,
        instructions: 'Listen to the announcement and answer Questions 1 and 2.',
        audioScript:
          'Attention passengers travelling to Edinburgh Waverley: the 14:20 express service has moved from Platform 4 to Platform 7 due to scheduled track maintenance. Refreshments are available in Coach C.',
        questions: [
          {
            order: 1,
            type: 'mcq',
            prompt: 'Which platform will the 14:20 Edinburgh express now depart from?',
            maxMarks: 1,
            correctAnswer: 'C',
            options: [
              { key: 'A', text: 'Platform 3' },
              { key: 'B', text: 'Platform 4' },
              { key: 'C', text: 'Platform 7', isCorrect: true },
            ],
          },
          {
            order: 2,
            type: 'completion',
            prompt: 'Refreshments are located in Coach ____.',
            maxMarks: 1,
            correctAnswer: 'C',
          },
        ],
      },
      {
        title: 'Reading & Grammar Precision',
        skill: 'Reading',
        order: 2,
        durationMinutes: 10,
        instructions: 'Select the grammatically accurate option.',
        passageTitle: 'Community Repair Workshops',
        passageText:
          'Across dozens of towns, volunteer-led repair cafés help residents mend small appliances and textiles rather than discarding them prematurely.',
        questions: [
          {
            order: 3,
            type: 'mcq',
            prompt: 'Choose the best connector: "____ the workshop ran for only three hours, volunteers repaired forty-two items."',
            maxMarks: 1,
            correctAnswer: 'A',
            options: [
              { key: 'A', text: 'Although', isCorrect: true },
              { key: 'B', text: 'Despite' },
              { key: 'C', text: 'Because of' },
            ],
          },
        ],
      },
      {
        title: 'Short Written Reflection',
        skill: 'Writing',
        order: 3,
        durationMinutes: 7,
        instructions: 'Write 80–120 words explaining why you are strengthening your English proficiency.',
        questions: [
          {
            order: 4,
            type: 'writing_task2',
            prompt: 'Describe a goal you hope to achieve with stronger English communication over the next twelve months.',
            maxMarks: 100,
          },
        ],
      },
    ]
  );

  // 3. Seed Demo Students + Realistic Completed Attempt & Report
  const demoEmail = 'student@meridian-assessment.org';
  const existingDemo = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail) as
    | { id: number }
    | undefined;

  if (!existingDemo) {
    const premiumPlan = db
      .prepare("SELECT id FROM subscription_plans WHERE code = 'PREMIUM'")
      .get() as { id: number };
    const freePlan = db
      .prepare("SELECT id FROM subscription_plans WHERE code = 'FREE'")
      .get() as { id: number };

    // Demo Premium Student
    const u1 = db
      .prepare(
        `INSERT INTO users (email, password_hash, role, email_verified, status)
         VALUES (?, ?, 'student', 1, 'active')`
      )
      .run(demoEmail, hashPassword('Meridian2026!'));
    const studentId = Number(u1.lastInsertRowid);

    db.prepare(
      `INSERT INTO student_profiles (user_id, full_name, phone, country, city, education_level, preferred_exam, target_score, intended_exam_date, objective, privacy_consent)
       VALUES (?, 'Amara Okafor', '+44 20 7946 0182', 'United Kingdom', 'Manchester', 'Postgraduate', 'IELTS_ACADEMIC', '7.5', '2027-02-15', 'Postgraduate MSc Admission', 1)`
    ).run(studentId);

    db.prepare(
      `INSERT INTO subscriptions (user_id, plan_id, status, starts_at, expires_at, attempts_used)
       VALUES (?, ?, 'active', datetime('now', '-10 days'), datetime('now', '+20 days'), 2)`
    ).run(studentId, premiumPlan.id);

    // Demo Free-Tier Student
    const u2 = db
      .prepare(
        `INSERT INTO users (email, password_hash, role, email_verified, status)
         VALUES (?, ?, 'student', 1, 'active')`
      )
      .run('starter@meridian-assessment.org', hashPassword('Meridian2026!'));
    const starterId = Number(u2.lastInsertRowid);

    db.prepare(
      `INSERT INTO student_profiles (user_id, full_name, country, education_level, preferred_exam, target_score, objective, privacy_consent)
       VALUES (?, 'Kenji Takahashi', 'Japan', 'Undergraduate', 'TOEFL_IBT', '100', 'Exchange Semester', 1)`
    ).run(starterId);

    db.prepare(
      `INSERT INTO subscriptions (user_id, plan_id, status, starts_at, expires_at, attempts_used)
       VALUES (?, ?, 'active', datetime('now'), datetime('now', '+365 days'), 0)`
    ).run(starterId, freePlan.id);

    // Seed two realistic completed IELTS attempts for Amara so analytics, charts, and QR verify work immediately
    const seedAttemptData = [
      {
        attemptNum: 1,
        daysAgo: 12,
        listening: 7.0,
        reading: 6.5,
        writing: 6.0,
        speaking: 6.5,
        overall: 6.5,
        cefr: 'B2',
        reportRef: 'MRD-RPT-2026-00418',
        verifyCode: 'MRD-2026-00418',
        summary:
          'Strong factual comprehension in Listening; Writing Task 2 arguments would benefit from tighter paragraph topic sentences and wider academic collocations.',
      },
      {
        attemptNum: 2,
        daysAgo: 3,
        listening: 7.5,
        reading: 7.5,
        writing: 6.5,
        speaking: 7.0,
        overall: 7.0,
        cefr: 'C1',
        reportRef: 'MRD-RPT-2026-00419',
        verifyCode: 'MRD-2026-00419',
        summary:
          'Clear progression to CEFR C1 overall. Listening accuracy and Reading True/False/Not Given discrimination improved markedly. Focus next on Writing complex clause variety and lexical precision.',
      },
    ];

    for (const item of seedAttemptData) {
      const attRes = db
        .prepare(
          `INSERT INTO exam_attempts (exam_id, user_id, attempt_number, status, started_at, expires_at, submitted_at, current_section_idx)
           VALUES (?, ?, ?, 'reviewed', datetime('now', ?), datetime('now', ?), datetime('now', ?), 3)`
        )
        .run(
          ieltsExamId,
          studentId,
          item.attemptNum,
          `-${item.daysAgo} days`,
          `-${item.daysAgo} days`,
          `-${item.daysAgo} days`
        );
      const attemptId = Number(attRes.lastInsertRowid);

      const resInsert = db
        .prepare(
          `INSERT INTO assessment_results (attempt_id, overall_score, overall_label, cefr_level, status, ai_model_version, review_notes, published_at, created_at)
           VALUES (?, ?, ?, ?, 'reviewed', 'gemini-4-hydrogen', 'Verified baseline diagnostic benchmark.', datetime('now', ?), datetime('now', ?))`
        )
        .run(
          attemptId,
          item.overall,
          `Band ${item.overall.toFixed(1)}`,
          item.cefr,
          `-${item.daysAgo} days`,
          `-${item.daysAgo} days`
        );
      const resultId = Number(resInsert.lastInsertRowid);

      const skillIns = db.prepare(
        `INSERT INTO skill_scores (result_id, skill, score, max_score, band_or_scale_label, criteria_json)
         VALUES (?, ?, ?, 9, ?, ?)`
      );
      skillIns.run(resultId, 'Listening', item.listening, `Band ${item.listening.toFixed(1)}`, '[]');
      skillIns.run(resultId, 'Reading', item.reading, `Band ${item.reading.toFixed(1)}`, '[]');
      skillIns.run(
        resultId,
        'Writing',
        item.writing,
        `Band ${item.writing.toFixed(1)}`,
        JSON.stringify([
          { name: 'Task Achievement / Response', score: item.writing, maxScore: 9, comment: 'Addresses all parts of the prompt clearly.' },
          { name: 'Coherence & Cohesion', score: item.writing + 0.5, maxScore: 9, comment: 'Logical progression across paragraphs.' },
          { name: 'Lexical Resource', score: item.writing, maxScore: 9, comment: 'Appropriate academic vocabulary with minor repetition.' },
          { name: 'Grammatical Range & Accuracy', score: item.writing, maxScore: 9, comment: 'Good mix of simple and complex structures.' },
        ])
      );
      skillIns.run(
        resultId,
        'Speaking',
        item.speaking,
        `Band ${item.speaking.toFixed(1)}`,
        JSON.stringify([
          { name: 'Fluency & Coherence', score: item.speaking, maxScore: 9, comment: 'Speaks at length with natural self-correction.' },
          { name: 'Lexical Resource', score: item.speaking, maxScore: 9, comment: 'Effective idiomatic and academic phrasing.' },
          { name: 'Grammatical Range & Accuracy', score: item.speaking - 0.5, maxScore: 9, comment: 'Occasional tense slips in hypothetical clauses.' },
          { name: 'Pronunciation', score: item.speaking, maxScore: 9, comment: 'Clear word stress and intelligible intonation.' },
        ])
      );

      db.prepare(
        `INSERT INTO ai_feedback (result_id, skill, criteria_scores_json, grammar_issues_json, vocabulary_notes, coherence_notes, fluency_notes, pronunciation_notes, strengths_json, weaknesses_json, recommendations_json, raw_summary, status)
         VALUES (?, 'Writing', ?, ?, ?, ?, '', '', ?, ?, ?, ?, 'completed')`
      ).run(
        resultId,
        JSON.stringify([
          { name: 'Task Response', score: item.writing, maxScore: 9, comment: 'Clear thesis and balanced evaluation.' },
          { name: 'Coherence & Cohesion', score: item.writing + 0.5, maxScore: 9, comment: 'Effective cohesive devices.' },
        ]),
        JSON.stringify(['Watch subject-verb agreement in long relative clauses', 'Use hedging modals in policy recommendations']),
        'Good command of academic collocations; vary reporting verbs beyond "show" and "increase".',
        'Topic sentences anchor each body paragraph reliably.',
        JSON.stringify(['Clear position maintained throughout', 'Accurate data overview in Task 1']),
        JSON.stringify(['Occasional repetitive sentence openings', 'Minor preposition slips']),
        JSON.stringify([
          'Practice combining concession clauses ("While online delivery lowers travel costs...")',
          'Target 275–295 words on Task 2 to allow deeper example development',
        ]),
        item.summary
      );

      const repIns = db
        .prepare(
          `INSERT INTO result_reports (result_id, attempt_id, user_id, candidate_ref, report_ref, verification_code, status, generated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'reviewed', datetime('now', ?))`
        )
        .run(
          resultId,
          attemptId,
          studentId,
          `CAN-${String(studentId).padStart(5, '0')}`,
          item.reportRef,
          item.verifyCode,
          `-${item.daysAgo} days`
        );
      const reportId = Number(repIns.lastInsertRowid);

      db.prepare(
        `INSERT INTO result_verifications (report_id, verification_code, verified_count)
         VALUES (?, ?, 1)`
      ).run(reportId, item.verifyCode);
    }

    db.prepare(
      `INSERT INTO notifications (user_id, title, message, category)
       VALUES (?, 'IELTS Academic Series 01 Result Published', 'Your unofficial assessment report MRD-2026-00419 (Band 7.0 · C1) is ready for PDF download and QR verification.', 'result')`
    ).run(studentId);
  }

  // 4. Seed Study Resources, FAQs, and Announcements
  const resCount = (db.prepare('SELECT COUNT(*) as c FROM study_resources').get() as { c: number }).c;
  if (resCount === 0) {
    const insRes = db.prepare(
      `INSERT INTO study_resources (slug, title, exam_family, skill, resource_type, summary, content, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    );

    insRes.run(
      'ielts-tfng-precision-guide',
      'Distinguishing False from Not Given in IELTS Academic Reading',
      'IELTS_ACADEMIC',
      'Reading',
      'Guide',
      'A systematic verification method for avoiding inference traps in True / False / Not Given tasks.',
      'In IELTS Academic Reading, FALSE means the passage explicitly states the opposite of the statement, whereas NOT GIVEN means the passage neither confirms nor contradicts the specific claim. Always isolate qualifying adverbs such as "exclusively", "all", or "prior to" before deciding.',
    );

    insRes.run(
      'pte-describe-image-structure',
      'Structuring High-Scoring PTE Describe Image Responses in 40 Seconds',
      'PTE_ACADEMIC',
      'Speaking',
      'Guide',
      'Maintain steady oral fluency and cover extreme data points without hesitation.',
      'Allocate 5 seconds to introduce the chart subject, 25 seconds to report the highest, lowest, and comparative trends using exact figures, and 10 seconds to deliver a concise concluding implication.',
    );

    insRes.run(
      'toefl-academic-discussion-rubric',
      'Mastering the TOEFL iBT Academic Discussion Writing Task',
      'TOEFL_IBT',
      'Writing',
      'Article',
      'How to synthesize peers’ viewpoints while advancing an original, well-justified argument in 10 minutes.',
      'Aim for 120–160 tightly edited words. Reference a classmate’s point briefly, introduce a distinct analytical angle, and illustrate it with a concrete policy or campus example.',
    );

    insRes.run(
      'faq-official-status',
      'Are Meridian Assessment reports official IELTS, PTE, or TOEFL certificates?',
      'ALL',
      'General',
      'FAQ',
      'Independent unofficial practice & diagnostic assessments.',
      'No. Meridian Assessment provides independent, unofficial diagnostic scores, AI-assisted rubric feedback, and QR-verified practice reports for preparation and institutional placement. Official certification must be taken through authorized IELTS Partners, Pearson VUE, or ETS test centres.',
    );

    insRes.run(
      'faq-ai-transparency',
      'How does AI-assisted Writing and Speaking assessment work?',
      'ALL',
      'General',
      'FAQ',
      'Transparent 4-criteria rubric evaluation with optional examiner moderation.',
      'Writing submissions and spoken transcripts are evaluated against transparent examination rubrics via our server-side assessment engine. If the AI service is unavailable or a candidate requests human verification, responses enter our examiner review queue.',
    );

    insRes.run(
      'faq-autosave-timer',
      'What happens if my internet disconnects or I refresh during a timed mock test?',
      'ALL',
      'General',
      'FAQ',
      'Continuous server autosave and server-validated countdown.',
      'Your answers and flagged questions are saved continuously to the database. Reloading restores your active attempt with the exact remaining time calculated from your server-side expiry timestamp.',
    );

    insRes.run(
      'banner-2026-series',
      '2026 Academic Mock Series Now Open — Free CEFR Diagnostic Included',
      'ALL',
      'General',
      'Banner',
      'Start with a free timed diagnostic or full IELTS Academic mock with instant objective grading.',
      'All newly registered candidates receive complimentary access to our General English CEFR Diagnostic and IELTS Academic Series 01.',
    );
  }
}
