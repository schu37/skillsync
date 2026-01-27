import { GoogleGenAI, Type, Schema } from "@google/genai";
import { 
  LessonPlan, 
  SoftSkillsLessonPlan, 
  TechnicalLessonPlan, 
  OthersLessonPlan,
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
const DEBUG = (import.meta as any).env?.DEV ?? false; // Automatically false in production builds

const logApi = (label: string, data: any) => {
  if (DEBUG) {
    console.group(`🤖 Gemini API: ${label}`);
    console.log(data);
    console.log('Full data (no truncation):', JSON.stringify(data, null, 2).slice(0, 5000)); // Show up to 5000 chars
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

const ContentWarningSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    hasConcerns: { type: Type.BOOLEAN, description: "True if any content concerns were detected" },
    isSuspicious: { type: Type.BOOLEAN, description: "True if content appears misleading, clickbait, or makes extraordinary claims" },
    isMisinformation: { type: Type.BOOLEAN, description: "True if content contains factually incorrect or debunked claims" },
    isUnsafe: { type: Type.BOOLEAN, description: "True if content shows dangerous practices without proper safety warnings" },
    concerns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific concerns detected (e.g., 'Claims miracle cure without evidence')" },
    recommendation: { type: Type.STRING, description: "Brief recommendation for the user (e.g., 'Verify claims with authoritative sources')" },
  },
  required: ["hasConcerns", "isSuspicious", "isMisinformation", "isUnsafe", "concerns", "recommendation"],
};

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
    videoDurationSeconds: { type: Type.NUMBER, description: "The ACTUAL total duration of the video in seconds. MUST be accurate." },
    skillsDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
    contentWarning: ContentWarningSchema,
    summary: { type: Type.STRING },
    videoContext: { type: Type.STRING, description: "Detailed summary of the video content for grounding." },
    stopPoints: { type: Type.ARRAY, items: StopPointSchema },
    scenarioPreset: { type: Type.STRING, description: "The scenario type detected (negotiation, interview, etc.)" },
    rolePlayPersona: { type: Type.STRING, description: "A persona description for voice roleplay practice." },
  },
  required: ["videoDurationSeconds", "skillsDetected", "contentWarning", "summary", "videoContext", "stopPoints"],
};

const ComponentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the ingredient, component, or part" },
    quantity: { type: Type.STRING, description: "Amount with units (e.g., '2 cups', '½ tsp', '1 large', '10 cloves')" },
    specifications: { type: Type.STRING, description: "Details like size, type, grade (e.g., 'finely chopped', 'fine grind')" },
    purpose: { type: Type.STRING, description: "What this ingredient/component is used for" },
    alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
    estimatedCost: { type: Type.STRING },
  },
  required: ["name", "quantity"],
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
    videoDurationSeconds: { type: Type.NUMBER, description: "The ACTUAL total duration of the video in seconds. MUST be accurate." },
    skillsDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
    contentWarning: ContentWarningSchema,
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
  required: ["videoDurationSeconds", "skillsDetected", "contentWarning", "summary", "videoContext", "stopPoints", "projectType", "components", "tools", "buildSteps", "designDecisions"],
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
    isEducational: {
      type: Type.BOOLEAN,
      description: "True if video contains educational/learnable content, false for pure entertainment"
    },
    detectedMode: { 
      type: Type.STRING, 
      description: "Either 'technical' or 'soft' based on video content",
      nullable: true
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
  required: ["isEducational", "confidence", "reasoning"],
};

// ============================================
// MODE AUTO-DETECTION (Exported)
// ============================================

export interface ModeDetectionResult {
  mode: SkillMode;
  confidence: number;
  reasoning: string;
}

/**
 * Auto-detect whether video is technical or soft skills
 * Lightweight API call that just analyzes the video category
 */
export const detectVideoMode = async (
  videoUrlOrId: string
): Promise<ModeDetectionResult> => {
  const youtubeUrl = normalizeYouTubeUrl(videoUrlOrId);
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const systemPrompt = `
You are analyzing a video to determine if it contains educational/learnable content and classify it.

IMPORTANT: Set isEducational=true for ANY educational content including:
- Tutorials with OR without narration (visual demonstrations count!)
- How-to videos (cooking, crafts, building, repairs)
- Technical demonstrations (even if silent)
- Communication/soft skills demonstrations
- Step-by-step processes shown visually

ONLY set isEducational=false for pure entertainment with NO learning value:
- Comedy sketches, vlogs, reactions (no skills taught)
- Music videos, gaming highlights (no tutorial aspect)
- Random memes, advertisements
- Pure product showcases (no how-to or educational aspect)
- Entertainment content with zero instructional value

IF isEducational=true, then classify as:

TECHNICAL SKILLS (mode: 'technical'):
- DIY/maker projects, builds, repairs
- Electronics, woodworking, 3D printing
- Coding tutorials, technical how-tos
- Engineering, science experiments
- Cooking/baking demonstrations (even without narration)
- Any hands-on building, making, or crafting

SOFT SKILLS (mode: 'soft'):
- Communication, negotiation, persuasion
- Leadership, management, teamwork
- Interviews, presentations, public speaking
- Sales, customer service, conflict resolution
- Psychology, emotional intelligence

Return JSON with: { "isEducational": boolean, "mode": "soft" | "technical" | null, "confidence": number, "reason": "brief explanation" }
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
      isEducational: result.isEducational,
      detected: result.detectedMode,
      confidence: result.confidence,
      reasoning: result.reasoning
    });

    // Classify non-educational content as 'others' instead of rejecting
    if (result.isEducational === false) {
      return {
        mode: 'others',
        confidence: result.confidence || 80,
        reasoning: result.reasoning || 'No clear educational content detected'
      };
    }

    if (!result.detectedMode) {
      // Default to 'others' if classification unclear
      return {
        mode: 'others',
        confidence: 50,
        reasoning: 'Could not determine specific learning category'
      };
    }

    return {
      mode: result.detectedMode === 'technical' ? 'technical' : 'soft',
      confidence: result.confidence || 50,
      reasoning: result.reasoning || 'Detected educational content',
    };
  } catch (e) {
    console.error('Mode detection failed, defaulting to user selection', e);
    // If error, don't block - let user choose mode
    throw e;
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
  
  // Check cache first (only for the requested mode)
  if (!options.forceRefresh) {
    const cached = videoCache.get(youtubeUrl, userSelectedMode);
    
    if (cached) {
      logApi('generateLessonPlan - CACHE HIT', { url: youtubeUrl, mode: cached.mode });
      return cached;
    }
  }
  
  logApi('generateLessonPlan - Calling API (full analysis)', { url: youtubeUrl, userSelectedMode });
  
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  // Generate plan based on user-selected mode
  // Auto-detection is disabled to respect user choice and avoid API overload
  let plan: LessonPlan;
  if (userSelectedMode === 'technical') {
    plan = await generateTechnicalLessonPlan(ai, youtubeUrl, options.projectType);
  } else if (userSelectedMode === 'others') {
    // For 'others' mode, generate a basic plan without roleplay
    const othersPlan = await generateSoftSkillsLessonPlan(ai, youtubeUrl, undefined, undefined, true);
    // Override mode to 'others' since generateSoftSkillsLessonPlan defaults to 'soft'
    plan = { ...othersPlan, mode: 'others' as const };
  } else {
    plan = await generateSoftSkillsLessonPlan(ai, youtubeUrl, options.scenarioPreset);
  }
  
  // Cache based on the user-selected mode, not the auto-detected mode
  videoCache.set(youtubeUrl, userSelectedMode, plan);
  videoContextCache.set(youtubeUrl, userSelectedMode, videoContextCache.extractFromPlan(plan));
  
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
  regenerationSeed?: number,
  excludeRoleplay?: boolean
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

⚠️ FIRST: Determine the EXACT video duration in seconds and store it in videoDurationSeconds. This is CRITICAL for timestamp validation.

1. IDENTIFY 1-3 key soft skills being demonstrated or taught
2. ANALYZE CONTENT TRUSTWORTHINESS - Generate a contentWarning object:
   - hasConcerns: true if ANY of the below flags are true
   - isSuspicious: true if content uses clickbait, makes extraordinary claims, or appears misleading
   - isMisinformation: true if content contains factually incorrect, debunked, or pseudoscientific claims
   - isUnsafe: true if content shows dangerous practices without proper safety warnings
   - concerns: List specific concerns (e.g., "Claims guaranteed success without evidence", "Manipulative tactics presented as legitimate")
   - recommendation: Brief advice for users (e.g., "Verify claims independently", "Consider ethical implications")
   
   SET hasConcerns=false and empty concerns array if video appears legitimate and trustworthy.

3. CREATE a detailed summary of the video content
4. DETERMINE the optimal number of questions based on:
${STOP_POINTS_GUIDANCE}

QUESTION TYPES TO USE (mix these for comprehensive learning):
${getQuestionTypesReference()}

FOR EACH STOP POINT:
- timestamp: Exact second to pause (be precise based on what you see/hear)
  ⚠️ CRITICAL: ALL timestamps MUST be LESS THAN videoDurationSeconds. NEVER generate a timestamp >= video length.
  ⚠️ Example: If videoDurationSeconds=161, all timestamps must be 0-160.
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

${excludeRoleplay ? '' : 'CREATE A ROLEPLAY PERSONA for voice practice:\n- A character the user can practice with (e.g., "demanding boss", "skeptical client")'}

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
      ...(excludeRoleplay ? { rolePlayPersona: undefined } : {}),
    } as SoftSkillsLessonPlan;
    logApi('generateSoftSkillsLessonPlan - Parsed', { 
      stopPointsCount: result.stopPoints?.length,
      skills: result.skillsDetected,
      hasConcerns: result.contentWarning?.hasConcerns 
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

⚠️ FIRST: Determine the EXACT video duration in seconds and store it in videoDurationSeconds. This is CRITICAL for timestamp validation.

1. IDENTIFY the project type and difficulty level (beginner/intermediate/advanced)

2. ANALYZE CONTENT TRUSTWORTHINESS - Generate a contentWarning object:
   - hasConcerns: true if ANY of the below flags are true
   - isSuspicious: true if content uses clickbait, makes extraordinary claims, or appears misleading
   - isMisinformation: true if content contains factually incorrect, debunked, or pseudoscientific claims
   - isUnsafe: true if content shows DANGEROUS practices without proper safety warnings (electrical hazards, chemical reactions, structural risks, etc.)
   - concerns: List specific concerns (e.g., "No safety glasses worn while grinding", "Incorrect wiring could cause fire")
   - recommendation: Brief advice for users (e.g., "Always wear PPE", "Consult a licensed electrician")
   
   SET hasConcerns=false and empty concerns array if video appears legitimate and follows proper safety practices.

3. EXTRACT **EVERY SINGLE** component/ingredient/part/material mentioned in the video:
   - COOKING: ALL ingredients with EXACT measurements (e.g., "2 cups flour", "½ tsp salt", "1 large onion")
   - ELECTRONICS: ALL components with specifications (e.g., "10kΩ resistor", "Arduino Uno", "5V power supply")
   - WOODWORKING: ALL materials with dimensions (e.g., "2x4 lumber, 8ft", "wood screws #8 x 1.5in")
   - AUTOMOTIVE: ALL parts with model numbers (e.g., "oil filter FL-500S", "5W-30 oil, 5 quarts")
   - 3D PRINTING: ALL filament types, settings, hardware
   - CRAFTS/DIY: ALL materials with quantities
   
   ⚠️ DO NOT SKIP OR OMIT ANY ITEMS, including:
   - Common items (oil, salt, water, screws, tape, glue, wire, etc.)
   - Items mentioned but not emphasized
   - Items shown on screen but not spoken aloud
   - Consumables and disposables
   
   ⚠️ Include EXACT quantities/measurements as stated in the video
3. LIST ALL tools required or recommended
4. CREATE step-by-step BUILD INSTRUCTIONS
5. IDENTIFY DESIGN DECISIONS and explain the "why"
6. DETERMINE the optimal number of questions based on:
${STOP_POINTS_GUIDANCE}

QUESTION TYPES TO USE (mix these for comprehensive learning):
${getQuestionTypesReference()}

FOR EACH STOP POINT:
- timestamp: Exact second to pause for the question
  ⚠️ CRITICAL: ALL timestamps MUST be LESS THAN videoDurationSeconds. NEVER generate a timestamp >= video length.
  ⚠️ Example: If videoDurationSeconds=161, all timestamps must be 0-160.
- Generate questions with proper questionType from the list above
- Focus on design-reasoning, application, and diagnostic questions for technical content
- scoringCriteria: 3-5 specific criteria, points totaling 5

BALANCE YOUR QUESTIONS:
- At least one factual question about components/specifications
- At least one design-reasoning question (WHY choices were made)
- At least one application or synthesis question

7. WRITE a safety overview with required precautions

CRITICAL REQUIREMENT: The components array MUST be COMPLETE. If a video mentions 11 items, you must list 11 components. If a video shows 15 parts, you must list 15 components. NEVER summarize, group, or omit items. Completeness is essential for users who need to purchase materials.

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
    return generateLessonPlan(videoUrlOrId, mode, { forceRefresh: true });
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
  } else if (mode === 'others') {
    return regenerateOthersQuestions(ai, youtubeUrl, cachedContext, regenerationSeed);
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
      contentWarning: context.contentWarning,
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
      contentWarning: context.contentWarning,
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

const regenerateOthersQuestions = async (
  ai: GoogleGenAI,
  youtubeUrl: string,
  context: any,
  regenerationSeed: number
): Promise<OthersLessonPlan> => {
  const systemPrompt = `
You are an expert instructional designer for 'SkillSync'.

REGENERATION REQUEST #${regenerationSeed}: Generate COMPLETELY DIFFERENT questions than before.

You have already analyzed this video. Here is the context:

VIDEO SUMMARY: ${context.summary}
VIDEO CONTEXT: ${context.videoContext}
SKILLS DETECTED: ${context.skillsDetected.join(', ')}

NOW GENERATE NEW STOP POINTS (questions only):
- Create 4-8 NEW questions at DIFFERENT timestamps than before
- Focus on DIFFERENT aspects of the content
- Include comprehension, application, and analysis questions
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
  logApi('regenerateOthersQuestions - Response', { rawText: text.slice(0, 300) + '...' });
  
  try {
    const parsed = JSON.parse(text);
    const result: OthersLessonPlan = {
      id: crypto.randomUUID(),
      videoUrl: youtubeUrl,
      mode: 'others',
      createdAt: new Date().toISOString(),
      skillsDetected: context.skillsDetected,
      contentWarning: context.contentWarning,
      summary: context.summary,
      videoContext: context.videoContext,
      stopPoints: parsed.stopPoints || [],
      scenarioPreset: context.scenarioPreset,
    };
    
    // Cache the new plan
    videoCache.set(youtubeUrl, 'others', result);
    
    return result;
  } catch (e) {
    console.error("Failed to parse regenerated others questions", e);
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
  // The last message should be from user, and we need to ensure the model generates a response
  const contents = conversationHistory.length === 0
    ? [{ role: 'user' as const, parts: [{ text: 'Start the roleplay scenario.' }] }]
    : conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.content }]
      }));

  // If the last message isn't from user, add a prompt to continue
  if (contents.length > 0 && contents[contents.length - 1].role !== 'user') {
    contents.push({ role: 'user' as const, parts: [{ text: '(Continue the roleplay based on what was just said)' }] });
  }

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
Include DETAILED sections for:
- **Components/Parts List** - Include EXACT model numbers, specifications, and quantities mentioned in the video
  - For each part, note any alternatives mentioned
  - Include estimated price ranges if discussed
- **Where to Buy** - Suggest marketplaces for these parts:
  - Amazon, AliExpress, Banggood for general electronics
  - Specialty stores mentioned in the video
  - Note: "Check local hobby shops for faster shipping"
- **Tools Required** - Specific tool brands/models if mentioned
- **Key Build Steps** - Numbered steps with timestamps
- **Safety Considerations** - Warnings from the video
- **Specifications & Settings** - Any calibration values, firmware settings, or configurations
` : '';

  const softSkillsSection = plan.mode === 'soft' ? `
Include sections for:
- **Key Techniques** - Communication strategies discussed
- **Example Phrases** - Specific wording suggestions from the video
- **Body Language Tips** - Non-verbal communication points
- **Practice Scenarios** - Situations to practice these skills
` : '';

  const systemPrompt = `You are creating comprehensive study notes for a video learning session.

VIDEO SUMMARY: ${plan.summary}
VIDEO CONTEXT: ${plan.videoContext}
SKILLS: ${plan.skillsDetected.join(', ')}
MODE: ${plan.mode === 'technical' ? 'Technical/DIY' : 'Soft Skills'}

Create well-structured markdown notes that include:
1. **Key Concepts** - Main ideas from the video
2. **Important Points** - Bullet points of crucial information
3. **Timestamps Reference** - Key moments worth rewatching (format: [MM:SS])
4. **Action Items** - What the learner should practice
${technicalSection}${softSkillsSection}

IMPORTANT FOR TECHNICAL VIDEOS:
- Extract SPECIFIC product names, model numbers, and specs mentioned
- Don't just say "Thermal Camera" - say "TC256 Thermal Camera Module (160x120 resolution, 25Hz)"
- Include links format: "Available on: Amazon, AliExpress, GetFPV"
- Note any vendor recommendations from the video creator

Format in clean markdown. Be detailed and comprehensive.
Target 500-800 words for technical videos, 300-500 for soft skills.`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.flash,
      contents: `Generate detailed study notes for this video. For technical content, include exact part specifications and where to buy them.`,
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

IMPORTANT RESTRICTIONS:
- ONLY answer questions about this specific video and its content
- ONLY discuss topics directly related to the skills and concepts covered in the video
- If the user asks about unrelated topics, politely redirect them back to the video content
- You may discuss broader context that helps understand the video, but stay focused on the learning material

INSTRUCTIONS:
- Answer questions about the video content clearly and accurately
- Provide clarifications and explanations based on what was shown in the video
- Reference specific parts of the video when helpful
- Be conversational but informative and focused
- If asked about something not covered in the video, acknowledge it and redirect: "That's not covered in this video, but I can help you understand [related topic from the video]."
- Keep responses concise (2-4 paragraphs max)
- Use plain text formatting - avoid markdown syntax like ** or * as they will be displayed literally`;

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

/**
 * Analyze voice audio and generate roleplay response with emotion
 */
export const analyzeVoiceAndRespond = async (
  audioBlob: Blob,
  config: { persona: string; scenario: string; videoContext: string },
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): Promise<{
  userTranscript: string;
  prosodyAnalysis: string;
  responseText: string;
  emotionalTone: string;
  voiceDirection: string;
}> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  // Convert blob to base64
  const base64Audio = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  const conversationContext = conversationHistory.length > 0 
    ? `\n\nConversation so far:\n${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}`
    : '';

  const prompt = `You are roleplaying as: ${config.persona}

Scenario: ${config.scenario}

Context from video: ${config.videoContext}${conversationContext}

The user just sent you a voice message. 

STEP 1: Analyze their voice for:
- Tone (confident/nervous/assertive/passive/defensive)
- Emotion (calm/frustrated/excited/angry/anxious)
- Pace (rushed/measured/hesitant/slow)
- Volume/energy (high/medium/low)
- Speech patterns (clear/mumbling/stammering)
- Overall delivery quality

STEP 2: Respond IN CHARACTER based on:
- What they said (content)
- HOW they said it (prosody - tone, pace, emotion)
- The roleplay scenario context
- Your character's personality

STEP 3: Choose your emotional response appropriately:
- If they're confident and assertive → be more challenging/skeptical or respectful (depends on character)
- If they're nervous or hesitant → be impatient, dismissive, or encouraging (depends on scenario)
- If they're defensive → push back or probe deeper
- Match realistic human reactions to their delivery

STEP 4: Keep responses natural and conversational (2-3 sentences usually)

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "userTranscript": "what they said word-for-word",
  "prosodyAnalysis": "Brief analysis: [confident/nervous] tone, [fast/slow] pace, [high/low] energy",
  "responseText": "Your natural response in character",
  "emotionalTone": "impatient|grateful|skeptical|angry|friendly|neutral|frustrated|dismissive|encouraging",
  "voiceDirection": "How to deliver the response (e.g., 'speak firmly', 'sound exasperated')"
}`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.flash,
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'audio/webm',
              data: base64Audio
            }
          }
        ]
      }],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const result = JSON.parse(response.text);
    logApi('analyzeVoiceAndRespond', { 
      prosody: result.prosodyAnalysis, 
      emotion: result.emotionalTone 
    });
    
    return result;
  } catch (e) {
    console.error('Voice analysis error:', e);
    // Fallback response
    return {
      userTranscript: '(Could not transcribe)',
      prosodyAnalysis: 'Unable to analyze',
      responseText: "I didn't quite catch that. Could you try again?",
      emotionalTone: 'neutral',
      voiceDirection: 'speak normally'
    };
  }
};

// ============================================
// GEMINI TEXT-TO-SPEECH (TTS)
// ============================================

export interface GeminiTTSConfig {
  text: string;
  voiceName?: string;       // One of the 30 prebuilt voices (default: 'Kore')
  emotion?: string;         // Emotional direction (e.g., 'impatient', 'friendly')
  persona?: string;         // Character description for context
  style?: string;           // Additional style guidance
}

/**
 * Generate natural speech audio using Gemini TTS model.
 * Returns raw PCM audio data (16-bit, 24kHz, mono) as a Blob.
 * 
 * This uses the gemini-2.5-flash-preview-tts model which provides:
 * - 30 expressive prebuilt voices
 * - Natural language style control
 * - Emotional expression through prompts
 */
export const geminiTTS = async (config: GeminiTTSConfig): Promise<Blob> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  // Select voice based on emotion or persona
  const voiceName = config.voiceName || selectVoiceForEmotion(config.emotion || 'neutral');
  
  // Build the TTS prompt with style direction
  const prompt = buildTTSPrompt(config);
  
  logApi('geminiTTS', { voiceName, emotion: config.emotion, textLength: config.text.length });
  
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.tts,
      contents: prompt,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
      },
    });
    
    // Extract audio data from response
    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    
    if (part?.inlineData?.data) {
      // The API returns base64 encoded PCM audio
      const audioData = base64ToArrayBuffer(part.inlineData.data);
      
      // Convert raw PCM to WAV for browser playback
      const wavBlob = pcmToWav(audioData, 24000, 1, 16);
      
      logApi('geminiTTS success', { 
        audioSize: wavBlob.size,
        voice: voiceName 
      });
      
      return wavBlob;
    }
    
    throw new Error('No audio data in response');
    
  } catch (e) {
    console.error('Gemini TTS error:', e);
    throw e;
  }
};

/**
 * Select the best voice based on the emotional tone needed.
 */
const selectVoiceForEmotion = (emotion: string): string => {
  const emotionLower = emotion.toLowerCase();
  
  // Map emotions to appropriate voices
  if (emotionLower.includes('angry') || emotionLower.includes('frustrated') || emotionLower.includes('impatient')) {
    return 'Kore'; // Firm voice for assertive/tense emotions
  }
  if (emotionLower.includes('friendly') || emotionLower.includes('warm') || emotionLower.includes('encouraging')) {
    return 'Achird'; // Friendly voice
  }
  if (emotionLower.includes('skeptical') || emotionLower.includes('dismissive')) {
    return 'Charon'; // Informative but can sound skeptical
  }
  if (emotionLower.includes('excited') || emotionLower.includes('enthusiastic')) {
    return 'Fenrir'; // Excitable voice
  }
  if (emotionLower.includes('calm') || emotionLower.includes('soothing')) {
    return 'Sulafat'; // Warm voice
  }
  if (emotionLower.includes('professional') || emotionLower.includes('neutral')) {
    return 'Orus'; // Firm but neutral
  }
  if (emotionLower.includes('casual') || emotionLower.includes('relaxed')) {
    return 'Zubenelgenubi'; // Casual voice
  }
  if (emotionLower.includes('sad') || emotionLower.includes('sympathetic')) {
    return 'Achernar'; // Soft voice
  }
  
  // Default to a versatile voice
  return 'Kore';
};

/**
 * Select a consistent voice for an entire roleplay session based on persona description.
 * This is called ONCE at session start and the same voice is used for all rounds.
 * Exported so it can be used by the voice roleplay hook.
 * 
 * Voice genders from Gemini TTS API:
 * MALE: Achird, Algenib, Algieba, Alnilam, Charon, Orus, Puck, Fenrir, Iapetus, Enceladus, Umbriel, Gacrux, Sadaltager
 * FEMALE: Achernar, Aoede, Autonoe, Callirrhoe, Kore, Leda, Zephyr, Erinome, Despina, Laomedeia, Schedar, Pulcherrima, Sulafat, Vindemiatrix, Rasalgethi, Sadachbia
 */
export const selectVoiceForPersona = (persona: string): string => {
  const personaLower = persona.toLowerCase();
  
  // Check for gender/character hints
  const isMale = personaLower.includes('he ') || 
                 personaLower.includes('his ') || 
                 personaLower.includes('man') || 
                 personaLower.includes('male') ||
                 personaLower.includes('boss') ||
                 personaLower.includes('sir') ||
                 personaLower.includes('mr.');
  
  const isFemale = personaLower.includes('she ') || 
                   personaLower.includes('her ') || 
                   personaLower.includes('woman') || 
                   personaLower.includes('female') ||
                   personaLower.includes('ms.') ||
                   personaLower.includes('mrs.') ||
                   personaLower.includes('miss');

  // Check for personality traits
  const isAggressive = personaLower.includes('angry') || 
                       personaLower.includes('frustrated') || 
                       personaLower.includes('demanding') ||
                       personaLower.includes('impatient') ||
                       personaLower.includes('difficult');
  
  const isFriendly = personaLower.includes('friendly') || 
                     personaLower.includes('warm') || 
                     personaLower.includes('nice') ||
                     personaLower.includes('kind') ||
                     personaLower.includes('supportive');
  
  const isProfessional = personaLower.includes('professional') || 
                         personaLower.includes('executive') || 
                         personaLower.includes('manager') ||
                         personaLower.includes('interviewer') ||
                         personaLower.includes('ceo') ||
                         personaLower.includes('officer') ||
                         personaLower.includes('director') ||
                         personaLower.includes('formal');
  
  const isSkeptical = personaLower.includes('skeptic') || 
                      personaLower.includes('doubt') || 
                      personaLower.includes('critical') ||
                      personaLower.includes('questioning');
  
  // Select voice based on personality + gender combination
  // Using CORRECT genders from Gemini TTS API
  if (isAggressive) {
    // Firm voices for aggressive characters
    return isFemale ? 'Kore' : 'Alnilam'; // Kore=Firm(F), Alnilam=Firm(M)
  }
  
  if (isSkeptical) {
    // Informative/questioning voices
    return isFemale ? 'Erinome' : 'Charon'; // Erinome=Clear(F), Charon=Informative(M)
  }
  
  if (isProfessional) {
    // Professional/formal voices
    return isFemale ? 'Kore' : 'Orus'; // Kore=Firm(F), Orus=Firm(M)
  }
  
  if (isFriendly) {
    // Friendly/warm voices
    return isFemale ? 'Aoede' : 'Achird'; // Aoede=Breezy(F), Achird=Friendly(M)
  }
  
  // Default voices based on gender
  if (isFemale) {
    return 'Sulafat'; // Warm female voice
  }
  if (isMale) {
    return 'Charon'; // Informative male voice
  }
  
  // Ultimate default - female professional voice (neutral for unknown gender)
  return 'Kore';
};

/**
 * Build a rich TTS prompt that includes style direction.
 */
const buildTTSPrompt = (config: GeminiTTSConfig): string => {
  const { text, emotion, persona, style } = config;
  
  // If no style guidance, just return the text
  if (!emotion && !persona && !style) {
    return text;
  }
  
  // Build director's notes for more expressive output
  let prompt = '';
  
  if (persona || style) {
    prompt += `### DIRECTOR'S NOTES\n`;
    if (persona) {
      prompt += `Character: ${persona}\n`;
    }
    if (emotion) {
      prompt += `Emotion: Speak with ${emotion} tone\n`;
    }
    if (style) {
      prompt += `Style: ${style}\n`;
    }
    prompt += `\n### TRANSCRIPT\n`;
  } else if (emotion) {
    // Simple emotion prefix
    prompt += `Say with ${emotion} emotion: `;
  }
  
  prompt += text;
  
  return prompt;
};

/**
 * Convert base64 string to ArrayBuffer
 */
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Convert raw PCM data to WAV format for browser playback.
 * Gemini TTS returns 16-bit PCM at 24kHz.
 */
const pcmToWav = (pcmData: ArrayBuffer, sampleRate: number, numChannels: number, bitsPerSample: number): Blob => {
  const pcmBytes = new Uint8Array(pcmData);
  const wavBuffer = new ArrayBuffer(44 + pcmBytes.length);
  const view = new DataView(wavBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM format
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, pcmBytes.length, true);
  
  // Copy PCM data
  const wavBytes = new Uint8Array(wavBuffer);
  wavBytes.set(pcmBytes, 44);
  
  return new Blob([wavBuffer], { type: 'audio/wav' });
};
