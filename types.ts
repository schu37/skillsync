// ============================================
// APP STATE
// ============================================

export enum AppMode {
  IDLE = 'IDLE',
  DETECTING_MODE = 'DETECTING_MODE',  // Auto-detecting video category
  MODE_DETECTED = 'MODE_DETECTED',    // Showing detected mode, awaiting confirmation
  LOADING_PLAN = 'LOADING_PLAN',
  PLAN_READY = 'PLAN_READY',
  PLAYING = 'PLAYING',
  PAUSED_INTERACTION = 'PAUSED_INTERACTION',
  EVALUATING = 'EVALUATING',
  FEEDBACK = 'FEEDBACK',
  COMPLETED = 'COMPLETED',
  GENERATING_PACK = 'GENERATING_PACK',
  PACK_READY = 'PACK_READY',
  VOICE_ROLEPLAY = 'VOICE_ROLEPLAY',
  ASKING_QUESTION = 'ASKING_QUESTION',
}

export type SkillMode = 'soft' | 'technical' | 'others';

export type QuestionType = 'prediction' | 'diagnostic' | 'synthesis' | 'design-reasoning';

// ============================================
// STOP POINTS & QUESTIONS
// ============================================

export interface ScoringCriterion {
  criterion: string;      // e.g., "Identifies the key negotiation tactic used"
  points: number;         // e.g., 1
  description?: string;   // Optional explanation for this criterion
}

export interface StopPoint {
  id: string;
  timestamp: number; // in seconds
  contextSummary: string;
  question: string;
  questionType: 'factual' | 'conceptual' | 'prediction' | 'diagnostic' | 'application' | 'synthesis' | 'design-reasoning' | 'evaluation' | 'open-ended' | 'reflection';
  rubric: string;
  referenceAnswer: string;
  scoringCriteria?: ScoringCriterion[]; // Specific criteria for scoring (should total 5 points)
}

// Stored answer for a question
export interface AnsweredQuestion {
  stopPointId: string;
  question: string;
  userAnswer: string;
  evaluation: Evaluation;
  answeredAt: string;
}

// Session data stored per video+mode
export interface VideoSession {
  videoUrl: string;
  mode: SkillMode;
  lessonPlanId: string;
  answeredQuestions: AnsweredQuestion[];
  lastAccessedAt: string;
  regenerationCount: number; // Track how many times questions were regenerated
}

// ============================================
// TECHNICAL MODE: Components, Tools, Build Steps
// ============================================

export interface Component {
  name: string;
  quantity: string; // Amount with units (e.g., "2 cups", "½ tsp", "1 large", "×3")
  specifications?: string;
  purpose?: string;
  alternatives?: string[];
  estimatedCost?: string;
}

export interface Tool {
  name: string;
  required: boolean;
  purpose: string;
  safetyNotes?: string;
}

export interface BuildStep {
  stepNumber: number;
  title: string;
  description: string;
  timestamp?: number;
  duration?: string;
  tips?: string[];
  safetyWarnings?: string[];
  requiredComponents?: string[];
  requiredTools?: string[];
  checkpoints?: string[];
}

export interface DesignDecision {
  question: string;
  answer: string;
  timestamp?: number;
  alternatives?: string;
  tradeoffs?: string;
}

// ============================================
// LESSON PLANS (Base + Mode-Specific)
// ============================================

export interface BaseLessonPlan {
  id: string;
  videoUrl: string;
  mode: SkillMode;
  videoDurationSeconds?: number; // Actual video duration in seconds for timestamp validation
  skillsDetected: string[];
  suitabilityScore: number; // 0-100
  summary: string;
  videoContext: string;
  stopPoints: StopPoint[];
  createdAt: string;
}

export interface SoftSkillsLessonPlan extends BaseLessonPlan {
  mode: 'soft';
  scenarioPreset?: string;
  rolePlayPersona?: string;
}

export interface TechnicalLessonPlan extends BaseLessonPlan {
  mode: 'technical';
  projectType: string;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  estimatedBuildTime?: string;
  components: Component[];
  tools: Tool[];
  buildSteps: BuildStep[];
  designDecisions: DesignDecision[];
  safetyOverview?: string;
  requiredPrecautions?: string[];
}

export interface OthersLessonPlan extends BaseLessonPlan {
  mode: 'others';
  scenarioPreset?: string; // May have a fallback scenario from soft skills generation
}

// Union type for easy handling
export type LessonPlan = SoftSkillsLessonPlan | TechnicalLessonPlan | OthersLessonPlan;

// Type guard
export const isTechnicalPlan = (plan: LessonPlan): plan is TechnicalLessonPlan =>
  plan.mode === 'technical';

// Make sure these type guards are exported
export const isSoftSkillsPlan = (plan: LessonPlan): plan is SoftSkillsLessonPlan => {
  return plan.mode === 'soft';
};

export const isOthersPlan = (plan: LessonPlan): plan is OthersLessonPlan => {
  return plan.mode === 'others';
};

// ============================================
// EVALUATION & FEEDBACK
// ============================================

export interface EvidenceQuote {
  text: string;
  timestamp?: number;
  url?: string;
}

export interface Evaluation {
  score: number; // 0-5
  strengths: string[];
  improvements: string[];
  rewrittenAnswer: string;
  evidence: EvidenceQuote[];
}

// ============================================
// TECHNICAL Q&A (with web search)
// ============================================

export interface TechnicalQuestion {
  question: string;
  answer: string;
  source: 'video' | 'web-search';
  confidence: number;
  citations?: EvidenceQuote[];
}

// ============================================
// SESSION & STORAGE
// ============================================

export interface SessionHistoryItem {
  stopPointId: string;
  question: string;
  answer: string;
  evaluation: Evaluation;
}

export interface UserSession {
  id: string;
  lessonPlanId: string;
  history: SessionHistoryItem[];
  completedAt?: string;
}

export interface SavedLessonPlan {
  id: string;
  lessonPlan: LessonPlan;
  sessions: UserSession[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// STUDY PACK & EXPORT
// ============================================

export interface StudyPack {
  markdown: string;
}

export interface ExportedDocument {
  type: 'google-docs' | 'google-sheets' | 'markdown';
  url?: string;
  filename?: string;
  createdAt: string;
}

// ============================================
// VOICE FEATURES
// ============================================

export interface VoiceMetrics {
  pitch: number;
  volume: number;
  pitchStability: number;
  confidence: 'nervous' | 'neutral' | 'confident';
}

export interface RolePlayMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  audioUrl?: string;
  metrics?: VoiceMetrics;
}
