import { GoogleGenAI, Type, Schema } from "@google/genai";
import { 
  LessonPlan, 
  SoftSkillsLessonPlan, 
  TechnicalLessonPlan, 
  Evaluation, 
  StudyPack, 
  StopPoint,
  TechnicalQuestion,
  SkillMode 
} from "../types";
import { GEMINI_MODELS, STOP_POINTS_GUIDANCE, QUESTION_TYPES } from "../constants";

// ============================================
// DEBUG LOGGING
// ============================================
const DEBUG = true; // Set to false in production

const logApi = (label: string, data: any) => {
  if (DEBUG) {
    console.group(`🤖 Gemini API: ${label}`);
    console.log(data);
    console.groupEnd();
  }
};

// Helper to get API key safely
const getApiKey = () => {
  // Try Vite env first, then process.env
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || 
         (import.meta as any).env?.API_KEY || 
         (typeof process !== 'undefined' ? process.env.API_KEY : '') || 
         '';
};

// Convert YouTube URL to full URL if only ID provided
// Normalizes shorts URLs to standard watch URLs for consistency
const normalizeYouTubeUrl = (urlOrId: string): string => {
  // Handle YouTube Shorts - convert to standard watch URL
  const shortsMatch = urlOrId.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) {
    return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
  }
  
  // Already a full URL
  if (urlOrId.includes('youtube.com') || urlOrId.includes('youtu.be')) {
    return urlOrId;
  }
  
  // Just a video ID
  return `https://www.youtube.com/watch?v=${urlOrId}`;
};

// ============================================
// SCHEMAS
// ============================================

const ScoringCriterionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    criterion: { type: Type.STRING, description: "A specific criterion the answer must meet (e.g., 'Identifies the negotiation tactic used')" },
    points: { type: Type.NUMBER, description: "Points awarded for meeting this criterion (total across all criteria should be 5)" },
    description: { type: Type.STRING, description: "Optional explanation of what qualifies as meeting this criterion" },
  },
  required: ["criterion", "points"],
};

const StopPointSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    timestamp: { type: Type.NUMBER, description: "Timestamp in seconds where the video should pause." },
    contextSummary: { type: Type.STRING, description: "Brief summary of what just happened in the video leading up to this point." },
    question: { type: Type.STRING, description: "An interactive question to test the user's understanding." },
    questionType: { type: Type.STRING, description: "Type of question: prediction, diagnostic, synthesis, or design-reasoning" },
    rubric: { type: Type.STRING, description: "Criteria for a good answer." },
    referenceAnswer: { type: Type.STRING, description: "An ideal expert answer." },
    scoringCriteria: { 
      type: Type.ARRAY, 
      items: ScoringCriterionSchema,
      description: "3-5 specific, measurable criteria for scoring this question. Points must total exactly 5."
    },
  },
  required: ["id", "timestamp", "contextSummary", "question", "rubric", "referenceAnswer", "scoringCriteria"],
};

const SoftSkillsLessonPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    skillsDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
    suitabilityScore: { type: Type.NUMBER, description: "0 to 100 score indicating how educational the video is." },
    summary: { type: Type.STRING },
    videoContext: { type: Type.STRING, description: "Detailed summary of the video content for grounding." },
    stopPoints: { type: Type.ARRAY, items: StopPointSchema },
    scenarioPreset: { type: Type.STRING, description: "The scenario type detected (negotiation, interview, etc.)" },
    rolePlayPersona: { type: Type.STRING, description: "A persona description for voice roleplay practice." },
  },
  required: ["skillsDetected", "suitabilityScore", "summary", "videoContext", "stopPoints"],
};

const ComponentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    quantity: { type: Type.NUMBER },
    specifications: { type: Type.STRING },
    purpose: { type: Type.STRING },
    alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
    estimatedCost: { type: Type.STRING },
  },
  required: ["name"],
};

const ToolSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    required: { type: Type.BOOLEAN },
    purpose: { type: Type.STRING },
    safetyNotes: { type: Type.STRING },
  },
  required: ["name", "required", "purpose"],
};

const BuildStepSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    stepNumber: { type: Type.NUMBER },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    timestamp: { type: Type.NUMBER },
    duration: { type: Type.STRING },
    tips: { type: Type.ARRAY, items: { type: Type.STRING } },
    safetyWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    checkpoints: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["stepNumber", "title", "description"],
};

const DesignDecisionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING, description: "A 'why' question about a design choice made in the video" },
    answer: { type: Type.STRING },
    timestamp: { type: Type.NUMBER },
    alternatives: { type: Type.STRING },
    tradeoffs: { type: Type.STRING },
  },
  required: ["question", "answer"],
};

const TechnicalLessonPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    skillsDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
    suitabilityScore: { type: Type.NUMBER },
    summary: { type: Type.STRING },
    videoContext: { type: Type.STRING },
    stopPoints: { type: Type.ARRAY, items: StopPointSchema },
    projectType: { type: Type.STRING },
    difficultyLevel: { type: Type.STRING },
    estimatedBuildTime: { type: Type.STRING },
    components: { type: Type.ARRAY, items: ComponentSchema },
    tools: { type: Type.ARRAY, items: ToolSchema },
    buildSteps: { type: Type.ARRAY, items: BuildStepSchema },
    designDecisions: { type: Type.ARRAY, items: DesignDecisionSchema },
    safetyOverview: { type: Type.STRING },
    requiredPrecautions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["skillsDetected", "suitabilityScore", "summary", "videoContext", "stopPoints", "projectType", "components", "tools", "buildSteps", "designDecisions"],
};

const EvidenceQuoteSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING },
    timestamp: { type: Type.NUMBER },
  },
  required: ["text"],
};

const EvaluationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER, description: "0 to 5 score." },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
    rewrittenAnswer: { type: Type.STRING },
    evidence: { type: Type.ARRAY, items: EvidenceQuoteSchema },
  },
  required: ["score", "strengths", "improvements", "rewrittenAnswer", "evidence"],
};

const TechnicalQuestionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING },
    answer: { type: Type.STRING },
    source: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    citations: { type: Type.ARRAY, items: EvidenceQuoteSchema },
  },
  required: ["question", "answer", "source", "confidence"],
};

// Add a schema for mode detection
const ModeDetectionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    detectedMode: { 
      type: Type.STRING, 
      description: "Either 'technical' or 'soft' based on video content" 
    },
    confidence: { 
      type: Type.NUMBER, 
      description: "0-100 confidence in the detection" 
    },
    reasoning: { 
      type: Type.STRING, 
      description: "Brief explanation of why this mode was chosen" 
    },
  },
  required: ["detectedMode", "confidence", "reasoning"],
};

/**
 * Auto-detect whether video is technical or soft skills
 */
const detectVideoMode = async (
  ai: GoogleGenAI,
  youtubeUrl: string
): Promise<{ mode: SkillMode; confidence: number; reasoning: string }> => {
  const systemPrompt = `
You are analyzing a video to determine if it's primarily about:

TECHNICAL SKILLS (mode: 'technical'):
- DIY/maker projects, builds, repairs
- Electronics, woodworking, 3D printing
- Coding tutorials, technical how-tos
- Engineering, science experiments
- Any hands-on building or making

SOFT SKILLS (mode: 'soft'):
- Communication, negotiation, persuasion
- Leadership, management, teamwork
- Interviews, presentations, public speaking
- Sales, customer service, conflict resolution
- Psychology, emotional intelligence

Analyze the video content and determine which mode best fits.
If it's a mix, choose the PRIMARY focus.
`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.flashPreview,
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: youtubeUrl } },
            { text: "Analyze this video and determine if it's primarily technical skills or soft skills content." }
          ]
        }
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: ModeDetectionSchema,
      },
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    
    logApi('detectVideoMode', { 
      url: youtubeUrl, 
      detected: result.detectedMode,
      confidence: result.confidence,
      reasoning: result.reasoning 
    });

    return {
      mode: result.detectedMode === 'technical' ? 'technical' : 'soft',
      confidence: result.confidence || 50,
      reasoning: result.reasoning || 'Unable to determine',
    };
  } catch (e) {
    console.error('Mode detection failed, defaulting to user selection', e);
    return { mode: 'soft', confidence: 0, reasoning: 'Detection failed' };
  }
};

// ============================================
// LESSON PLAN GENERATION
// ============================================

import { videoCache, sessionStorage, videoContextCache } from './storageService';

export interface GenerateLessonOptions {
  scenarioPreset?: string;
  projectType?: string;
  forceRefresh?: boolean;
  regenerate?: boolean; // Force new questions even if cached
}

export const generateLessonPlan = async (
  videoUrlOrId: string,
  userSelectedMode: SkillMode,
  options: GenerateLessonOptions = {}
): Promise<LessonPlan> => {
  const youtubeUrl = normalizeYouTubeUrl(videoUrlOrId);
  
  // If regenerating, use lightweight method
  if (options.regenerate) {
    return regenerateQuestionsOnly(videoUrlOrId, userSelectedMode, options);
  }
  
  // Check cache first
  if (!options.forceRefresh) {
    // Try both modes in cache
    const cachedSoft = videoCache.get(youtubeUrl, 'soft');
    const cachedTech = videoCache.get(youtubeUrl, 'technical');
    
    if (cachedSoft || cachedTech) {
      const cached = cachedSoft || cachedTech;
      logApi('generateLessonPlan - CACHE HIT', { url: youtubeUrl, mode: cached!.mode });
      return cached!;
    }
  }
  
  logApi('generateLessonPlan - Calling API (full analysis)', { url: youtubeUrl, userSelectedMode });
  
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  // Auto-detect mode if user selected 'soft' but video might be technical
  // This helps catch misclassifications
  let effectiveMode = userSelectedMode;
  
  // Only auto-detect if not forcing a specific mode
  if (!options.projectType && !options.scenarioPreset) {
    const detection = await detectVideoMode(ai, youtubeUrl);
    
    // If high confidence detection differs from user selection, use detected mode
    if (detection.confidence >= 70 && detection.mode !== userSelectedMode) {
      logApi('generateLessonPlan - Mode override', { 
        userSelected: userSelectedMode, 
        detected: detection.mode,
        confidence: detection.confidence,
        reasoning: detection.reasoning
      });
      effectiveMode = detection.mode;
    }
  }

  let plan: LessonPlan;
  if (effectiveMode === 'technical') {
    plan = await generateTechnicalLessonPlan(ai, youtubeUrl, options.projectType);
  } else {
    plan = await generateSoftSkillsLessonPlan(ai, youtubeUrl, options.scenarioPreset);
  }
  
  // Cache both the full plan AND the video context separately
  videoCache.set(youtubeUrl, effectiveMode, plan);
  videoContextCache.set(youtubeUrl, effectiveMode, videoContextCache.extractFromPlan(plan));
  
  return plan;
};

const getQuestionTypesReference = () => {
  return Object.values(QUESTION_TYPES)
    .map(qt => `- ${qt.id}: ${qt.name} - ${qt.description}. Example: "${qt.example}"`)
    .join('\n');
};

const generateSoftSkillsLessonPlan = async (
  ai: GoogleGenAI,
  youtubeUrl: string,
  scenarioPreset?: string,
  regenerationSeed?: number
): Promise<SoftSkillsLessonPlan> => {
  const scenarioContext = scenarioPreset 
    ? `The user is specifically practicing: ${scenarioPreset}.`
    : 'Detect the most appropriate scenario from the video content.';

  const regenerationNote = regenerationSeed 
    ? `REGENERATION REQUEST #${regenerationSeed}: Generate DIFFERENT questions than before. Focus on different moments, angles, or aspects of the content.`
    : '';

  const systemPrompt = `
You are an expert instructional designer for 'SkillSync', an app that turns videos into interactive practice sessions.

MODE: Soft Skills (Focus on communication, negotiation, psychology, interpersonal skills)
${scenarioContext}
${regenerationNote}

WATCH THE VIDEO CAREFULLY and perform these tasks:

1. IDENTIFY 1-3 key soft skills being demonstrated or taught
2. RATE the video's educational value (0-100) for skill development
3. CREATE a detailed summary of the video content
4. DETERMINE the optimal number of questions based on:
${STOP_POINTS_GUIDANCE}

QUESTION TYPES TO USE (mix these for comprehensive learning):
${getQuestionTypesReference()}

FOR EACH STOP POINT:
- timestamp: Exact second to pause (be precise based on what you see/hear)
- contextSummary: What was just discussed or demonstrated
- question: A thoughtful question matching one of the types above
- questionType: One of: ${Object.keys(QUESTION_TYPES).map(k => QUESTION_TYPES[k as keyof typeof QUESTION_TYPES].id).join(', ')}
- rubric: Clear criteria for evaluating the answer
- referenceAnswer: An expert-level ideal answer
- scoringCriteria: Generate 3-5 SPECIFIC, MEASURABLE criteria for scoring this exact question. Points must total exactly 5.

BALANCE YOUR QUESTIONS:
- Include at least one factual/conceptual question (foundational)
- Include at least one prediction or diagnostic question (application)
- Include at least one synthesis, evaluation, or open-ended question (higher-order thinking)

CREATE A ROLEPLAY PERSONA for voice practice:
- A character the user can practice with (e.g., "demanding boss", "skeptical client")

Be specific and reference actual content from the video, not generic advice.
`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.flashPreview,
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { fileUri: youtubeUrl } },
          { text: "Analyze this video and create an interactive soft skills lesson plan." }
        ]
      }
    ],
    config: {
      systemInstruction: systemPrompt,
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: SoftSkillsLessonPlanSchema,
    },
  });

  logApi('generateSoftSkillsLessonPlan - Request', { youtubeUrl, scenarioPreset });
  
  const text = response.text || "{}";
  logApi('generateSoftSkillsLessonPlan - Response', { rawText: text.slice(0, 500) + '...' });
  
  try {
    const parsed = JSON.parse(text);
    const result = {
      ...parsed,
      id: crypto.randomUUID(),
      videoUrl: youtubeUrl,
      mode: 'soft' as const,
      createdAt: new Date().toISOString(),
    } as SoftSkillsLessonPlan;
    logApi('generateSoftSkillsLessonPlan - Parsed', { 
      stopPointsCount: result.stopPoints?.length,
      skills: result.skillsDetected,
      score: result.suitabilityScore 
    });
    return result;
  } catch (e) {
    console.error("Failed to parse Soft Skills Lesson Plan JSON", e, text);
    throw new Error("Failed to generate lesson plan. Please try again.");
  }
};

const generateTechnicalLessonPlan = async (
  ai: GoogleGenAI,
  youtubeUrl: string,
  projectType?: string,
  regenerationSeed?: number
): Promise<TechnicalLessonPlan> => {
  const projectContext = projectType
    ? `Project type hint: ${projectType}.`
    : 'Detect the project type from the video content.';

  const regenerationNote = regenerationSeed 
    ? `REGENERATION REQUEST #${regenerationSeed}: Generate DIFFERENT questions than before. Focus on different components, steps, or design decisions.`
    : '';

  const systemPrompt = `
You are an expert technical educator for 'SkillSync', an app that turns maker/DIY/technical videos into interactive learning experiences.

MODE: Technical Skills (Focus on process, tools, components, design decisions, safety)
${projectContext}
${regenerationNote}

WATCH THE VIDEO CAREFULLY and perform these tasks:

1. IDENTIFY the project type and difficulty level (beginner/intermediate/advanced)
2. EXTRACT ALL components/parts mentioned
3. LIST ALL tools required or recommended
4. CREATE step-by-step BUILD INSTRUCTIONS
5. IDENTIFY DESIGN DECISIONS and explain the "why"
6. DETERMINE the optimal number of questions based on:
${STOP_POINTS_GUIDANCE}

QUESTION TYPES TO USE (mix these for comprehensive learning):
${getQuestionTypesReference()}

FOR EACH STOP POINT:
- Generate questions with proper questionType from the list above
- Focus on design-reasoning, application, and diagnostic questions for technical content
- scoringCriteria: 3-5 specific criteria, points totaling 5

BALANCE YOUR QUESTIONS:
- At least one factual question about components/specifications
- At least one design-reasoning question (WHY choices were made)
- At least one application or synthesis question

7. WRITE a safety overview with required precautions

Be specific and reference actual content from the video.
`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.flashPreview,
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { fileUri: youtubeUrl } },
          { text: "Analyze this technical/maker video and create a comprehensive build guide with interactive questions." }
        ]
      }
    ],
    config: {
      systemInstruction: systemPrompt,
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: TechnicalLessonPlanSchema,
    },
  });

  const text = response.text || "{}";
  try {
    const parsed = JSON.parse(text);
    return {
      ...parsed,
      id: crypto.randomUUID(),
      videoUrl: youtubeUrl,
      mode: 'technical' as const,
      createdAt: new Date().toISOString(),
    } as TechnicalLessonPlan;
  } catch (e) {
    console.error("Failed to parse Technical Lesson Plan JSON", e, text);
    throw new Error("Failed to generate technical lesson plan. Please try again.");
  }
};

// ============================================
// ANSWER EVALUATION
// ============================================

export const evaluateAnswer = async (
  stopPoint: StopPoint,
  userAnswer: string,
  plan: LessonPlan
): Promise<Evaluation> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const modeContext = plan.mode === 'technical'
    ? `Technical project context. Focus on accuracy of technical understanding.`
    : `Soft skills context. Focus on communication effectiveness and interpersonal awareness.`;

  // Build scoring criteria section if available
  let scoringSection = '';
  if (stopPoint.scoringCriteria && stopPoint.scoringCriteria.length > 0) {
    const criteriaList = stopPoint.scoringCriteria
      .map((c, i) => `  ${i + 1}. "${c.criterion}" (${c.points} point${c.points > 1 ? 's' : ''})${c.description ? ` - ${c.description}` : ''}`)
      .join('\n');
    const totalPoints = stopPoint.scoringCriteria.reduce((sum, c) => sum + c.points, 0);
    
    scoringSection = `
SCORING CRITERIA (Total: ${totalPoints} points):
${criteriaList}

IMPORTANT: Award points ONLY for criteria that the user's answer clearly addresses.
- Add up the points from criteria met to get the final score (0-${totalPoints})
- Be specific about which criteria were met or missed
`;
  } else {
    scoringSection = `
SCORING GUIDELINES:
- 0: Completely wrong or irrelevant
- 1: Shows minimal understanding
- 2: Partially correct but missing key points
- 3: Acceptable answer, covers main points
- 4: Good answer with clear understanding
- 5: Excellent, expert-level answer
`;
  }

  const systemPrompt = `
You are a friendly but rigorous tutor for SkillSync.
${modeContext}

EVALUATE the user's answer based on:
- Video Context: ${plan.videoContext}
- Current Topic: ${stopPoint.contextSummary}
- Question: ${stopPoint.question}
- Rubric: ${stopPoint.rubric}
- Reference Answer: ${stopPoint.referenceAnswer}
${scoringSection}
TASKS:
1. Score 0-5 based on the scoring criteria above
2. List 2-3 specific STRENGTHS (what they got right, reference specific criteria if applicable)
3. List 2-3 specific IMPROVEMENTS (what criteria they missed or could improve)
4. REWRITE their answer to be excellent (maintain their voice but improve content)
5. CITE supporting evidence from the video context when possible

Be encouraging but honest. If they're close, acknowledge it.
`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.flashPreview,
    contents: `User's Answer: "${userAnswer}"`,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: EvaluationSchema,
    },
  });

  logApi('evaluateAnswer - Request', { 
    question: stopPoint.question.slice(0, 100),
    userAnswer: userAnswer.slice(0, 100) 
  });

  const text = response.text || "{}";
  logApi('evaluateAnswer - Response', { rawText: text.slice(0, 500) + '...' });
  
  try {
    const result = JSON.parse(text) as Evaluation;
    logApi('evaluateAnswer - Parsed', { score: result.score, strengthsCount: result.strengths?.length });
    return result;
  } catch (e) {
    console.error("Failed to parse Evaluation JSON", e);
    throw new Error("Failed to evaluate answer. Please try again.");
  }
};

// ============================================
// TECHNICAL Q&A WITH WEB SEARCH
// ============================================

export const answerTechnicalQuestion = async (
  question: string,
  plan: LessonPlan
): Promise<TechnicalQuestion> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const systemPrompt = `
You are a technical assistant for SkillSync.

The user is learning from a video and has a follow-up question.

VIDEO CONTEXT:
${plan.videoContext}

PROJECT: ${plan.mode === 'technical' ? (plan as TechnicalLessonPlan).projectType : 'N/A'}

INSTRUCTIONS:
1. FIRST, try to answer using information from the video context
2. If the answer is NOT in the video context, use Google Search to find it
3. Indicate whether your answer came from "video" or "web-search"
4. Rate your confidence 0.0-1.0 based on source reliability
5. Include citations with URLs when using web search

Be helpful and thorough. If you're unsure, say so.
`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.flashPreview,
    contents: `User Question: "${question}"`,
    config: {
      systemInstruction: systemPrompt,
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: TechnicalQuestionSchema,
    },
  });

  const text = response.text || "{}";
  try {
    return JSON.parse(text) as TechnicalQuestion;
  } catch (e) {
    console.error("Failed to parse TechnicalQuestion JSON", e);
    throw new Error("Failed to answer question. Please try again.");
  }
};

// ============================================
// STUDY PACK GENERATION
// ============================================

export const generateStudyPack = async (
  plan: LessonPlan,
  history: { question: string; answer: string; evaluation: Evaluation }[]
): Promise<StudyPack> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const historyText = history.map((h, i) => `
Q${i + 1}: ${h.question}
User Answer: ${h.answer}
Score: ${h.evaluation.score}/5
Improved Answer: ${h.evaluation.rewrittenAnswer}
  `).join("\n---\n");

  const technicalAdditions = plan.mode === 'technical' ? `
## Parts List
[Table of all components with quantities and purposes]

## Tools Required
[Checklist of tools, required vs optional]

## Build Steps Summary
[Quick reference of main steps]
  ` : '';

  const systemPrompt = `
You are creating a "Study Pack" markdown document for SkillSync.

VIDEO: ${plan.summary}
MODE: ${plan.mode === 'technical' ? 'Technical' : 'Soft Skills'}

Create a comprehensive, well-formatted markdown document:

# Study Pack: [Video Title]

## Core Skills Practiced
[List the skills with brief descriptions]

## Session Performance
[Summary of how the user did, overall score, key patterns]

## Question Review
[For each Q&A, show the question, user's answer, score, and improved version]

## Key Takeaways
[3-5 main lessons from the session]

## Recommended Practice
[3 specific exercises to improve weak areas]
${technicalAdditions}

## Next Steps
[What to practice next, related videos to watch]

Make it actionable and personalized based on their performance.
`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.flashPreview,
    contents: `Lesson Plan: ${JSON.stringify(plan)}\n\nSession History:\n${historyText}`,
    config: {
      systemInstruction: systemPrompt,
    },
  });

  return { markdown: response.text || "" };
};

// ============================================
// LIGHTWEIGHT QUESTION REGENERATION
// ============================================

/**
 * Regenerate questions using cached video context (no re-analysis needed)
 * Falls back to full analysis if no cache exists
 */
export const regenerateQuestionsOnly = async (
  videoUrlOrId: string,
  mode: SkillMode,
  options: GenerateLessonOptions = {}
): Promise<LessonPlan> => {
  const youtubeUrl = normalizeYouTubeUrl(videoUrlOrId);
  
  // Check for cached video context
  const cachedContext = videoContextCache.get(youtubeUrl, mode);
  
  if (!cachedContext) {
    // No cache - need full analysis
    logApi('regenerateQuestionsOnly - No cache, doing full analysis', { url: youtubeUrl });
    return generateLessonPlan(videoUrlOrId, mode, { ...options, regenerate: true });
  }
  
  logApi('regenerateQuestionsOnly - Using cached context', { 
    url: youtubeUrl, 
    mode,
    contextLength: cachedContext.videoContext.length 
  });
  
  const regenerationSeed = sessionStorage.incrementRegeneration(youtubeUrl, mode);
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  if (mode === 'technical') {
    return regenerateTechnicalQuestions(ai, youtubeUrl, cachedContext, regenerationSeed);
  } else {
    return regenerateSoftSkillsQuestions(ai, youtubeUrl, cachedContext, regenerationSeed);
  }
};

const regenerateSoftSkillsQuestions = async (
  ai: GoogleGenAI,
  youtubeUrl: string,
  context: any,
  regenerationSeed: number
): Promise<SoftSkillsLessonPlan> => {
  const systemPrompt = `
You are an expert instructional designer for 'SkillSync'.

REGENERATION REQUEST #${regenerationSeed}: Generate COMPLETELY DIFFERENT questions than before.

You have already analyzed this video. Here is the context:

VIDEO SUMMARY: ${context.summary}
VIDEO CONTEXT: ${context.videoContext}
SKILLS DETECTED: ${context.skillsDetected.join(', ')}
SCENARIO: ${context.scenarioPreset || 'General soft skills'}
ROLEPLAY PERSONA: ${context.rolePlayPersona || 'Professional colleague'}

NOW GENERATE NEW STOP POINTS (questions only):
- Create 4-8 NEW questions at DIFFERENT timestamps than before
- Focus on DIFFERENT aspects of the content
- Use a variety of question types: ${Object.keys(QUESTION_TYPES).map(k => QUESTION_TYPES[k as keyof typeof QUESTION_TYPES].id).join(', ')}
- Each question must have scoringCriteria (3-5 criteria, total 5 points)

Be creative and explore angles not covered in previous questions.
`;

  const StopPointsOnlySchema: Schema = {
    type: Type.OBJECT,
    properties: {
      stopPoints: { type: Type.ARRAY, items: StopPointSchema },
    },
    required: ["stopPoints"],
  };

  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.flashPreview,
    contents: `Generate new questions for this video based on the provided context.`,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: StopPointsOnlySchema,
    },
  });

  const text = response.text || "{}";
  logApi('regenerateSoftSkillsQuestions - Response', { rawText: text.slice(0, 300) + '...' });
  
  try {
    const parsed = JSON.parse(text);
    const result: SoftSkillsLessonPlan = {
      id: crypto.randomUUID(),
      videoUrl: youtubeUrl,
      mode: 'soft',
      createdAt: new Date().toISOString(),
      skillsDetected: context.skillsDetected,
      suitabilityScore: context.suitabilityScore,
      summary: context.summary,
      videoContext: context.videoContext,
      stopPoints: parsed.stopPoints || [],
      scenarioPreset: context.scenarioPreset,
      rolePlayPersona: context.rolePlayPersona,
    };
    
    // Cache the new plan
    videoCache.set(youtubeUrl, 'soft', result);
    
    return result;
  } catch (e) {
    console.error("Failed to parse regenerated questions", e);
    throw new Error("Failed to generate new questions. Please try again.");
  }
};

const regenerateTechnicalQuestions = async (
  ai: GoogleGenAI,
  youtubeUrl: string,
  context: any,
  regenerationSeed: number
): Promise<TechnicalLessonPlan> => {
  const systemPrompt = `
You are an expert technical educator for 'SkillSync'.

REGENERATION REQUEST #${regenerationSeed}: Generate COMPLETELY DIFFERENT questions than before.

You have already analyzed this video. Here is the context:

VIDEO SUMMARY: ${context.summary}
VIDEO CONTEXT: ${context.videoContext}
PROJECT TYPE: ${context.projectType}
COMPONENTS: ${JSON.stringify(context.components?.slice(0, 5))}
SKILLS DETECTED: ${context.skillsDetected.join(', ')}

NOW GENERATE NEW STOP POINTS (questions only):
- Create 4-8 NEW questions at DIFFERENT timestamps
- Focus on DIFFERENT components, steps, or design decisions
- Include design-reasoning, diagnostic, and application questions
- Each question must have scoringCriteria (3-5 criteria, total 5 points)

Be creative and explore angles not covered in previous questions.
`;

  const StopPointsOnlySchema: Schema = {
    type: Type.OBJECT,
    properties: {
      stopPoints: { type: Type.ARRAY, items: StopPointSchema },
    },
    required: ["stopPoints"],
  };

  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.flashPreview,
    contents: `Generate new technical questions for this video based on the provided context.`,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: StopPointsOnlySchema,
    },
  });

  const text = response.text || "{}";
  
  try {
    const parsed = JSON.parse(text);
    const result: TechnicalLessonPlan = {
      id: crypto.randomUUID(),
      videoUrl: youtubeUrl,
      mode: 'technical' as const,
      createdAt: new Date().toISOString(),
      skillsDetected: context.skillsDetected,
      suitabilityScore: context.suitabilityScore,
      summary: context.summary,
      videoContext: context.videoContext,
      stopPoints: parsed.stopPoints || [],
      projectType: context.projectType,
      difficultyLevel: context.difficultyLevel,
      estimatedBuildTime: context.estimatedBuildTime,
      components: context.components || [],
      tools: context.tools || [],
      buildSteps: context.buildSteps || [],
      designDecisions: context.designDecisions || [],
      safetyOverview: context.safetyOverview,
      requiredPrecautions: context.requiredPrecautions || [],
    };
    
    // Cache the new plan
    videoCache.set(youtubeUrl, 'technical', result);
    
    return result;
  } catch (e) {
    console.error("Failed to parse regenerated technical questions", e);
    throw new Error("Failed to generate new questions. Please try again.");
  }
};

// ============================================
// ROLEPLAY CHAT (Text-based fallback)
// ============================================

/**
 * Text-based roleplay chat using the standard Gemini API
 * This is a fallback when the Gemini Live API is unavailable
 */
export const roleplayChat = async (
  persona: string,
  scenario: string,
  videoContext: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const systemPrompt = `You are playing a character in a roleplay scenario for communication skills practice.

CHARACTER: ${persona}

SCENARIO CONTEXT: ${scenario}

VIDEO CONTEXT (what the user learned): ${videoContext.slice(0, 1000)}

INSTRUCTIONS:
- Stay in character throughout the conversation
- Be realistic but not hostile - push back appropriately as your character would
- Keep responses concise (2-4 sentences typically)
- Focus on: tone, persuasion techniques, active listening, handling objections
- After 4-6 exchanges, naturally conclude the conversation and briefly break character to give constructive feedback

${conversationHistory.length === 0 ? 'Start with a greeting appropriate to the scenario and your character.' : 'Continue the conversation naturally.'}`;

  // Build conversation for the API
  const contents = conversationHistory.length === 0
    ? [{ role: 'user' as const, parts: [{ text: 'Start the roleplay scenario.' }] }]
    : conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.content }]
      }));

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.flash,
      contents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const text = response.text || '';
    logApi('roleplayChat', { persona, historyLength: conversationHistory.length, response: text.slice(0, 200) });
    
    return text;
  } catch (e) {
    console.error('Roleplay chat error:', e);
    throw new Error('Failed to get AI response. Please try again.');
  }
};

// ============================================
// AUTO-GENERATE NOTES
// ============================================

/**
 * Generate structured notes from video content
 */
export const generateVideoNotes = async (
  plan: LessonPlan
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const technicalSection = plan.mode === 'technical' ? `
Include sections for:
- Components/Parts List (with quantities)
- Tools Required
- Key Build Steps
- Safety Considerations
` : '';

  const systemPrompt = `You are creating study notes for a video learning session.

VIDEO SUMMARY: ${plan.summary}
VIDEO CONTEXT: ${plan.videoContext}
SKILLS: ${plan.skillsDetected.join(', ')}
MODE: ${plan.mode === 'technical' ? 'Technical/DIY' : 'Soft Skills'}

Create well-structured markdown notes that include:
1. **Key Concepts** - Main ideas from the video
2. **Important Points** - Bullet points of crucial information
3. **Timestamps Reference** - Key moments worth rewatching
4. **Action Items** - What the learner should practice
${technicalSection}

Format in clean markdown. Be concise but comprehensive.
Keep it to about 300-500 words.`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.flash,
      contents: `Generate study notes for this video.`,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const notes = response.text || '';
    logApi('generateVideoNotes', { summary: plan.summary.slice(0, 100), notesLength: notes.length });
    return notes;
  } catch (e) {
    console.error('Failed to generate notes:', e);
    throw new Error('Failed to generate notes. Please try again.');
  }
};

// ============================================
// VIDEO CHAT (Ask questions about the video)
// ============================================

/**
 * Chat about video content - ask questions, get clarifications
 */
export const videoChatMessage = async (
  plan: LessonPlan,
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const systemPrompt = `You are a helpful tutor assistant for SkillSync. The user is learning from a video and wants to discuss or ask questions about its content.

VIDEO SUMMARY: ${plan.summary}
VIDEO CONTEXT: ${plan.videoContext}
SKILLS COVERED: ${plan.skillsDetected.join(', ')}
MODE: ${plan.mode === 'technical' ? 'Technical/DIY Build' : 'Soft Skills/Communication'}

${plan.mode === 'technical' ? `
TECHNICAL DETAILS:
- Project: ${(plan as TechnicalLessonPlan).projectType || 'N/A'}
- Components: ${JSON.stringify((plan as TechnicalLessonPlan).components?.slice(0, 5) || [])}
` : `
SOFT SKILLS CONTEXT:
- Scenario: ${(plan as SoftSkillsLessonPlan).scenarioPreset || 'General'}
`}

INSTRUCTIONS:
- Answer questions about the video content
- Provide clarifications and explanations
- Reference specific parts of the video when helpful
- Be conversational but informative
- If asked about something not in the video, say so and offer to help find related information
- Keep responses concise (2-4 paragraphs max)`;

  const contents = conversationHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' as const : 'model' as const,
    parts: [{ text: msg.content }]
  }));
  
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.flash,
      contents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const text = response.text || '';
    logApi('videoChatMessage', { userMessage: userMessage.slice(0, 50), response: text.slice(0, 100) });
    return text;
  } catch (e) {
    console.error('Video chat error:', e);
    throw new Error('Failed to get response. Please try again.');
  }
};
