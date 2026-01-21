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
  { id: 'custom', label: 'Custom Scenario', icon: '✏️', description: 'Define your own learning context' },
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
  { id: 'custom', label: 'Other Technical', icon: '⚙️', description: 'Any technical video' },
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
  flash: 'gemini-2.0-flash',
  flashPreview: 'gemini-3-flash-preview',
  live: 'gemini-2.0-flash-live-001',
} as const;

export const MAX_VIDEO_DURATION_MINUTES = 30;
export const STOP_POINTS_MIN = 3;
export const STOP_POINTS_MAX = 7;