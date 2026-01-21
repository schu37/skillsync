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
import { GEMINI_MODELS, STOP_POINTS_MIN, STOP_POINTS_MAX } from "../constants";

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
  },
  required: ["id", "timestamp", "contextSummary", "question", "rubric", "referenceAnswer"],
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

// ============================================
// LESSON PLAN GENERATION
// ============================================

export interface GenerateLessonOptions {
  scenarioPreset?: string;
  projectType?: string;
  forceRefresh?: boolean;  // Skip cache and fetch fresh
}

import { videoCache } from './storageService';

export const generateLessonPlan = async (
  videoUrlOrId: string,
  mode: SkillMode,
  options: GenerateLessonOptions = {}
): Promise<LessonPlan> => {
  const youtubeUrl = normalizeYouTubeUrl(videoUrlOrId);
  
  // Check cache first (unless force refresh)
  if (!options.forceRefresh) {
    const cached = videoCache.get(youtubeUrl, mode);
    if (cached) {
      logApi('generateLessonPlan - CACHE HIT', { url: youtubeUrl, mode });
      return cached;
    }
  }
  
  logApi('generateLessonPlan - CACHE MISS, calling API', { url: youtubeUrl, mode });
  
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  let plan: LessonPlan;
  if (mode === 'technical') {
    plan = await generateTechnicalLessonPlan(ai, youtubeUrl, options.projectType);
  } else {
    plan = await generateSoftSkillsLessonPlan(ai, youtubeUrl, options.scenarioPreset);
  }
  
  // Cache the result
  videoCache.set(youtubeUrl, mode, plan);
  
  return plan;
};

const generateSoftSkillsLessonPlan = async (
  ai: GoogleGenAI,
  youtubeUrl: string,
  scenarioPreset?: string
): Promise<SoftSkillsLessonPlan> => {
  const scenarioContext = scenarioPreset 
    ? `The user is specifically practicing: ${scenarioPreset}.`
    : 'Detect the most appropriate scenario from the video content.';

  const systemPrompt = `
You are an expert instructional designer for 'SkillSync', an app that turns videos into interactive practice sessions.

MODE: Soft Skills (Focus on communication, negotiation, psychology, interpersonal skills)
${scenarioContext}

WATCH THE VIDEO CAREFULLY and perform these tasks:

1. IDENTIFY 1-3 key soft skills being demonstrated or taught
2. RATE the video's educational value (0-100) for skill development
3. CREATE a detailed summary of the video content
4. GENERATE ${STOP_POINTS_MIN}-${STOP_POINTS_MAX} "Stop Points" at logical breaks where you'll pause to ask questions

FOR EACH STOP POINT:
- timestamp: Exact second to pause (be precise based on what you see/hear)
- contextSummary: What was just discussed or demonstrated
- question: Ask a PREDICTION question ("What should they say next?") or DIAGNOSTIC question ("What went wrong here?") or SYNTHESIS question ("How would you handle this differently?")
- questionType: One of: prediction, diagnostic, synthesis
- rubric: Clear criteria for evaluating the answer
- referenceAnswer: An expert-level ideal answer

CREATE A ROLEPLAY PERSONA for voice practice:
- A character the user can practice with (e.g., "demanding boss", "skeptical client")
- Include name, role, personality, and initial stance

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
  projectType?: string
): Promise<TechnicalLessonPlan> => {
  const projectContext = projectType
    ? `Project type hint: ${projectType}.`
    : 'Detect the project type from the video content.';

  const systemPrompt = `
You are an expert technical educator for 'SkillSync', an app that turns maker/DIY/technical videos into interactive learning experiences.

MODE: Technical Skills (Focus on process, tools, components, design decisions, safety)
${projectContext}

WATCH THE VIDEO CAREFULLY and perform these tasks:

1. IDENTIFY the project type and difficulty level (beginner/intermediate/advanced)
2. EXTRACT ALL components/parts mentioned:
   - Include quantities, specifications (voltage, size, etc.)
   - Explain the purpose of each component
   - Suggest alternatives if you know them
   - Estimate costs if possible

3. LIST ALL tools required or recommended:
   - Mark each as required vs optional
   - Include safety notes for dangerous tools

4. CREATE step-by-step BUILD INSTRUCTIONS:
   - Follow the video's order
   - Include timestamps for reference
   - Add tips and common mistakes to avoid
   - Include safety warnings where appropriate
   - Add verification checkpoints ("How to know this step is done correctly")

5. IDENTIFY DESIGN DECISIONS and explain the "why":
   - Example: "Why use 4 propellers instead of 2?"
   - Include engineering tradeoffs
   - Reference physics/electronics/mechanical principles

6. GENERATE ${STOP_POINTS_MIN}-${STOP_POINTS_MAX} Stop Points with DESIGN REASONING questions:
   - Ask "why" questions about choices made in the video
   - Example: "Why did they choose brushless motors over brushed?"
   - Include practical reasoning questions

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

  const systemPrompt = `
You are a friendly but rigorous tutor for SkillSync.
${modeContext}

EVALUATE the user's answer based on:
- Video Context: ${plan.videoContext}
- Current Topic: ${stopPoint.contextSummary}
- Question: ${stopPoint.question}
- Rubric: ${stopPoint.rubric}
- Reference Answer: ${stopPoint.referenceAnswer}

TASKS:
1. Score 0-5 (0=completely wrong, 3=acceptable, 5=excellent)
2. List 2-3 specific STRENGTHS (what they got right)
3. List 2-3 specific IMPROVEMENTS (what they could do better)
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
