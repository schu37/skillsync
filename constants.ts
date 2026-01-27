export const DEMO_VIDEO_ID = "-3w5Iw6fYZY"; // User provided example

// Removed hardcoded transcript. The app now uses Gemini 3 to analyze the video dynamically.

export const APP_TITLE = "SkillSync";
export const APP_DESCRIPTION = "Turn passive watching into active mastery.";

// ============================================
// SKILL MODES
// ============================================

export const SKILL_MODES = {
  soft: {
    label: 'Soft Skills',
    description: 'Communication, negotiation, psychology',
    icon: '💬',
  },
  technical: {
    label: 'Technical Skills',
    description: 'Process, tools, building, safety',
    icon: '🔧',
  },
  others: {
    label: 'General Content',
    description: 'Explore any video with AI tools',
    icon: '📺',
  },
} as const;

// ============================================
// SOFT SKILLS SCENARIO PRESETS
// ============================================

export const SOFT_SKILL_PRESETS = [
  { id: 'negotiation', label: 'Salary Negotiation', icon: '💰', description: 'Practice negotiating compensation with your manager' },
  { id: 'interview', label: 'Job Interview', icon: '🎯', description: 'Prepare for behavioral and technical interviews' },
  { id: 'conflict', label: 'Conflict Resolution', icon: '🤝', description: 'Handle workplace disagreements professionally' },
  { id: 'presentation', label: 'Presentation Skills', icon: '📊', description: 'Deliver compelling presentations' },
  { id: 'feedback', label: 'Giving Feedback', icon: '💡', description: 'Provide constructive feedback to colleagues' },
  { id: 'sales', label: 'Sales Pitch', icon: '📈', description: 'Persuade clients and close deals' },
] as const;

// ============================================
// TECHNICAL PROJECT TYPES
// ============================================

export const TECHNICAL_PROJECT_TYPES = [
  { id: 'electronics', label: 'Electronics/Arduino', icon: '⚡', description: 'Circuits, microcontrollers, IoT' },
  { id: 'drone', label: 'Drone/RC Build', icon: '🚁', description: 'Quadcopters, RC vehicles' },
  { id: 'woodworking', label: 'Woodworking', icon: '🪵', description: 'Furniture, carpentry projects' },
  { id: 'automotive', label: 'Automotive', icon: '🚗', description: 'Car repair, maintenance' },
  { id: '3dprinting', label: '3D Printing', icon: '🖨️', description: 'Design and print objects' },
  { id: 'plumbing', label: 'Plumbing/HVAC', icon: '🔧', description: 'Home repair, installations' },
  { id: 'cooking', label: 'Cooking/Baking', icon: '👨‍🍳', description: 'Recipes and techniques' },
  { id: 'crafts', label: 'DIY Crafts', icon: '🎨', description: 'Handmade projects' },
] as const;

// ============================================
// ROLE PLAY PERSONAS (for soft skills voice practice)
// ============================================

export const ROLEPLAY_PERSONAS = {
  negotiation: {
    name: 'Alex Thompson',
    role: 'Senior Director',
    style: 'Professional, direct, slightly skeptical but open to persuasion',
    initialPosition: 'We can offer a 3% raise, which is standard.',
  },
  interview: {
    name: 'Sarah Chen',
    role: 'Hiring Manager',
    style: 'Friendly but thorough, asks follow-up questions',
    initialPosition: 'Tell me about yourself and why you want this role.',
  },
  conflict: {
    name: 'Mike Rodriguez',
    role: 'Colleague',
    style: 'Frustrated but reasonable, wants to find a solution',
    initialPosition: 'We need to talk about how the project deadlines keep slipping.',
  },
  sales: {
    name: 'Jennifer Walsh',
    role: 'Potential Client',
    style: 'Busy, skeptical, needs to see clear value',
    initialPosition: 'I have 5 minutes. Why should I consider your solution?',
  },
} as const;

// ============================================
// API CONFIGURATION
// ============================================

export const GEMINI_MODELS = {
  flash: 'gemini-3-flash-preview',
  flashPreview: 'gemini-3-flash-preview',
  live: 'gemini-live-2.5-flash-preview-native-audio-09-2025', 
  pro: 'gemini-3-pro-preview', 
} as const;

export const MAX_VIDEO_DURATION_MINUTES = 30;

// Remove fixed STOP_POINTS_MIN and STOP_POINTS_MAX, replace with guidance
export const STOP_POINTS_GUIDANCE = `
Generate an appropriate number of questions based on video length and content density:
- Short videos (<5 min): 2-4 questions
- Medium videos (5-15 min): 4-6 questions  
- Long videos (15-30 min): 6-8 questions
- Very long videos (>30 min): 8-12 questions
Adjust based on content richness - more questions for dense educational content.
`;

// Question Types for structured learning
export const QUESTION_TYPES = {
  // Recall & Understanding
  FACTUAL: {
    id: 'factual',
    name: 'Factual Recall',
    description: 'Tests specific facts, definitions, or details from the video',
    example: 'What voltage did the speaker recommend for this circuit?',
    bloomLevel: 1,
  },
  CONCEPTUAL: {
    id: 'conceptual', 
    name: 'Conceptual Understanding',
    description: 'Tests understanding of concepts, principles, or relationships',
    example: 'Explain why the speaker chose a capacitor at this stage.',
    bloomLevel: 2,
  },
  
  // Application & Analysis
  PREDICTION: {
    id: 'prediction',
    name: 'Prediction',
    description: 'Asks what will/should happen next based on context',
    example: 'What do you think the speaker will do next to resolve this conflict?',
    bloomLevel: 3,
  },
  DIAGNOSTIC: {
    id: 'diagnostic',
    name: 'Diagnostic Analysis',
    description: 'Identifies problems, mistakes, or areas for improvement',
    example: 'What went wrong in this negotiation exchange?',
    bloomLevel: 4,
  },
  APPLICATION: {
    id: 'application',
    name: 'Real-World Application',
    description: 'Applies concepts to new situations or personal context',
    example: 'How would you use this technique in your own workplace?',
    bloomLevel: 3,
  },
  
  // Synthesis & Evaluation
  SYNTHESIS: {
    id: 'synthesis',
    name: 'Synthesis',
    description: 'Combines multiple concepts or creates new solutions',
    example: 'How would you modify this approach for a different audience?',
    bloomLevel: 5,
  },
  DESIGN_REASONING: {
    id: 'design-reasoning',
    name: 'Design Reasoning',
    description: 'Explains WHY certain choices were made (technical mode)',
    example: 'Why did they use brushless motors instead of brushed?',
    bloomLevel: 4,
  },
  EVALUATION: {
    id: 'evaluation',
    name: 'Critical Evaluation',
    description: 'Judges effectiveness, compares alternatives, critiques approach',
    example: 'Was the speaker\'s response effective? What would you do differently?',
    bloomLevel: 6,
  },
  
  // Open-ended & Creative
  OPEN_ENDED: {
    id: 'open-ended',
    name: 'Open-Ended Exploration',
    description: 'No single correct answer, encourages creative thinking',
    example: 'What other applications can you think of for this technique?',
    bloomLevel: 5,
  },
  REFLECTION: {
    id: 'reflection',
    name: 'Personal Reflection',
    description: 'Connects content to personal experience or goals',
    example: 'How does this relate to challenges you\'ve faced?',
    bloomLevel: 4,
  },
} as const;

export type QuestionTypeId = keyof typeof QUESTION_TYPES;