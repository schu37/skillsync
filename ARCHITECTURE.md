# SkillSync Architecture & Design Document

> **Last Updated**: January 28, 2026  
> **Version**: 0.9.1  
> **Hackathon**: Google Gemini 3 Devpost ($100K Prize Pool)  
> **Deadline**: Jan 30, 2026

---

## 🎯 Product Vision

**SkillSync** transforms passive video watching into active learning through AI-powered interactive practice sessions. Users paste a YouTube URL, and Gemini 3 analyzes the video to generate contextual questions, provide real-time feedback on answers, and enable voice-based roleplay for communication skills practice.

### Core Value Proposition
- **For Soft Skills**: Practice negotiation, communication, leadership through roleplay
- **For Technical Skills**: Learn DIY/maker projects with parts lists, build instructions, and safety guidance
- **For General Content**: Explore any video with AI-powered notes and chat

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  App.tsx    │  │ VideoPlayer │  │ LearningPanel│              │
│  │  (Router)   │  │ (YouTube)   │  │  (Unified)   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│  ┌──────▼────────────────▼────────────────▼──────┐              │
│  │              State Management (useState)       │              │
│  │  - mode, lessonPlan, currentStopIndex, etc.   │              │
│  └──────────────────────┬────────────────────────┘              │
│                         │                                        │
├─────────────────────────▼────────────────────────────────────────┤
│                      SERVICES LAYER                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ geminiService   │  │ storageService  │  │  exportService  │  │
│  │ - generatePlan  │  │ - localStorage  │  │ - Google Docs   │  │
│  │ - evaluateAns   │  │ - (Supabase)    │  │ - Google Sheets │  │
│  │ - voiceRoleplay │  │ - caching       │  │ - Markdown      │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │            │
├───────────▼────────────────────▼────────────────────▼────────────┤
│                       EXTERNAL APIs                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Gemini 3 API  │  │  YouTube IFrame │  │  Google OAuth   │  │
│  │  - Flash Preview│  │    API          │  │  - Docs API     │  │
│  │  - Live API     │  │                 │  │  - Sheets API   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure (Refactored v0.7.0)

```
Skillsync/
├── index.html              # Entry point
├── index.tsx               # React mount
├── App.tsx                 # Main app component, state management
├── types.ts                # TypeScript interfaces
├── constants.ts            # App configuration, presets
├── utils.ts                # Shared utility functions (NEW)
├── vite.config.ts          # Vite + env vars
├── tsconfig.json           # TypeScript config
├── package.json            # Dependencies
├── .env.local              # API keys (gitignored)
├── .env.example            # Template for env vars
├── ARCHITECTURE.md         # This file
│
├── components/
│   ├── VideoPlayer.tsx     # YouTube iframe + timeline markers
│   ├── ModeSelector.tsx    # Soft/Technical/General mode toggle
│   │
│   │── panels/             # Mode-specific panel content (NEW)
│   │   ├── LearningPanel.tsx   # Unified panel container (replaces 3 panels)
│   │   ├── PanelHeader.tsx     # Shared header component
│   │   ├── PanelTabs.tsx       # Shared tab navigation
│   │   └── SoftSkillsContent.tsx    # Soft-skills specific tabs (Roleplay intro)
│   │   └── TechnicalContent.tsx     # Technical-specific tabs (Parts, Tools, Steps, Design)
│   │   └── GeneralBanner.tsx        # Warning banner for general mode
│   │
│   ├── shared/             # Reusable components (NEW)
│   │   ├── QASection.tsx       # Q&A tab (unified across all modes)
│   │   ├── FeedbackDisplay.tsx # Score, strengths, improvements display
│   │   ├── TabButton.tsx       # Single tab button component
│   │   └── Badge.tsx           # Reusable badge component
│   │
│   ├── SafetyBanner.tsx    # Disclaimer for technical projects
│   ├── NotesSection.tsx    # Note-taking with auto-save
│   ├── VideoChatSection.tsx # AI chat about video content
│   └── VoiceRoleplay.tsx   # Voice conversation UI with prosody analysis
│
├── services/
│   ├── geminiService.ts    # All Gemini API calls
│   ├── storageService.ts   # localStorage + future Supabase
│   └── exportService.ts    # Google Docs/Sheets export
│
└── hooks/
    └── useVoiceInput.ts    # Web Speech API hooks
```

---

## 🔄 Component Refactoring (v0.7.0)

### Before: Duplicate Panel Components ❌

The old architecture had **3 separate panel components** with significant code duplication:

```
InteractionPanel.tsx (790 lines) - Soft Skills mode
TechnicalPanel.tsx   (623 lines) - Technical mode  
OthersPanel.tsx      (90 lines)  - General mode
────────────────────────────────
Total: ~1500 lines with duplicated:
  - Tab navigation logic
  - Q&A evaluation flow
  - Feedback display UI
  - Notes/Chat integration
  - Header styling
  - Container styling
```

### After: Unified Panel Architecture ✅

```
LearningPanel.tsx    (200 lines) - Unified container
├── PanelHeader.tsx  (50 lines)  - Mode-aware header
├── PanelTabs.tsx    (80 lines)  - Tab navigation
├── QASection.tsx    (250 lines) - Shared Q&A logic
├── FeedbackDisplay.tsx (100 lines) - Evaluation display
├── TechnicalContent.tsx (300 lines) - Parts, Tools, Steps, Design
├── SoftSkillsContent.tsx (50 lines) - Roleplay intro only
└── GeneralBanner.tsx (30 lines) - Warning for general mode
────────────────────────────────
Total: ~1060 lines (30% reduction)
```

### Key Design Principles

1. **Composition over Conditionals**: Instead of mode-based if/else, compose features
2. **Feature Flags**: Each mode defines which tabs/features are available
3. **Shared State**: Q&A state, notes, chat managed at LearningPanel level
4. **Mode Config Object**: Define mode differences declaratively

```typescript
// Mode configuration (declarative approach)
const MODE_CONFIG: Record<SkillMode, ModeConfig> = {
  soft: {
    tabs: ['qa', 'notes', 'chat'],
    hasRoleplay: true,
    headerBadge: { text: plan.scenario, color: 'indigo' },
    banner: null,
  },
  technical: {
    tabs: ['overview', 'parts', 'tools', 'steps', 'design', 'qa', 'notes', 'chat'],
    hasRoleplay: false,
    headerBadge: { text: plan.projectType, color: 'emerald' },
    banner: <SafetyBanner />,
  },
  others: {
    tabs: ['notes', 'chat'],
    hasRoleplay: false,
    headerBadge: { text: 'General Content', color: 'slate' },
    banner: <GeneralBanner />,
  },
};
```

### Shared Components

| Component | Purpose | Used By |
|-----------|---------|---------|
| `QASection` | Question display, answer input, navigation | Soft, Technical |
| `FeedbackDisplay` | Score visualization, strengths/improvements | Soft, Technical |
| `NotesSection` | Note-taking with AI toggle | All modes |
| `VideoChatSection` | AI chat (discuss/roleplay) | All modes |
| `PanelTabs` | Tab navigation with icons, counts | All modes |
| `PanelHeader` | Summary, badges, difficulty | All modes |

---

## 🔑 Key Features & Status

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Video Analysis (Gemini 3) | ✅ Done | P0 | Native YouTube URL input |
| Stop Point Questions | ✅ Done | P0 | Dynamic count based on video length |
| Answer Evaluation | ✅ Done | P0 | Score based on video-specific criteria |
| **Question Types System** | ✅ Done | P0 | Bloom's taxonomy-based variety |
| **Answered Questions Storage** | ✅ Done | P1 | 30-day persistence per video |
| **Skip Answered Toggle** | ✅ Done | P1 | Focus on unanswered questions |
| **Regenerate Questions** | ✅ Done | P1 | Get different questions for same video |
| Soft Skills Mode | ✅ Done | P0 | Communication, negotiation |
| Technical Skills Mode | ✅ Done | P0 | Parts list, build steps |
| **General Content Mode** | ✅ Done | P1 | Fallback for unclassified videos |
| Timeline Markers | ✅ Done | P1 | Clickable to seek |
| Question Click-to-Answer | ✅ Done | P1 | Jump to any question |
| API Logging (Debug) | ✅ Done | P1 | Console group logs |
| **Video Caching** | ✅ Done | P1 | 7-day TTL, per URL+mode |
| **Markdown Export** | ✅ Done | P1 | Download full session |
| **Google Docs Export** | ✅ Done | P1 | OAuprosody analysis integration |
| **Voice Roleplay in Chat** | ✅ Done | P1 | Integrated into Roleplay tab |
| **Voice Session Feedback** | ✅ Done | P1 | Qualitative end-of-session feedback |
| **Consistent Voice Personas** | ✅ Done | P1 | Same voice throughout session |
| **Sticky Tabs** | ✅ Done | P1 | Q&A/Notes/Chat tabs always visible |
| **Mode Switching** | ✅ Done | P1 | Change soft/technical after video load |
| **Unified Notes** | ✅ Done | P1 | Single notes area with AI toggle |
| **Tab State Persistence** | ✅ Done | P1 | Switching tabs preserves content |
| **Technical Mode Parity** | ✅ Done | P1 | Q&A, Notes, Chat in technical mode |
| **Safety Banner Persistence** | ✅ Done | P1 | No auto-play for technical projects |
| **Chat Export** | ✅ Done | P1 | Export chat to .md and Google Docs |
| Study Pack Generation | ✅ Done | P2 | Markdown summary |
| Safety Disclaimer | ✅ Done | P2 | User acknowledgment |
| Google Sheets Export | 🔨 Partial | P2 | Parts list export |
| **Legal Compliance** | ✅ Done | P1 | Privacy Policy, Terms of Service, AI Disclaimer |

---

## 📚 Question Types System

SkillSync uses a structured question taxonomy based on Bloom's Taxonomy to ensure comprehensive learning:

### Question Types

| Type | Bloom Level | Description | Example |
|------|-------------|-------------|---------|
| **Factual** | 1 (Remember) | Tests specific facts or details | "What voltage was recommended?" |
| **Conceptual** | 2 (Understand) | Tests understanding of concepts | "Explain why a capacitor is needed here" |
| **Prediction** | 3 (Apply) | What will/should happen next | "What should the speaker say next?" |
| **Application** | 3 (Apply) | Apply to new situations | "How would you use this at work?" |
| **Diagnostic** | 4 (Analyze) | Identify problems or issues | "What went wrong in this exchange?" |
| **Design-Reasoning** | 4 (Analyze) | Explain WHY choices were made | "Why use brushless motors?" |
| **Synthesis** | 5 (Evaluate) | Combine concepts creatively | "How would you modify this approach?" |
| **Evaluation** | 6 (Create) | Judge effectiveness, compare | "Was this response effective?" |
| **Open-Ended** | 5-6 | No single correct answer | "What other applications exist?" |
| **Reflection** | 4 | Connect to personal experience | "How does this relate to your challenges?" |

### Dynamic Question Count

Questions are generated based on video content, not fixed limits:
- Short videos (<5 min): 2-4 questions
- Medium videos (5-15 min): 4-6 questions
- Long videos (15-30 min): 6-8 questions
- Very long videos (>30 min): 8-12 questions

---

## 🧠 Gemini API Integration

### Gemini 3 Showcase - Key Features Used

This project leverages **Gemini 3's cutting-edge capabilities** to transform video learning:

| Feature | How We Use It | Why It's Powerful |
|---------|--------------|-------------------|
| 🎥 **Native Video Understanding** | Direct YouTube URL input via `fileData.fileUri` | No preprocessing/transcription needed - Gemini "watches" the video |
| 🎯 **Multimodal Analysis** | Processes video, audio, visual demonstrations simultaneously | Understands context from speech, on-screen text, and physical actions |
| 🔍 **Grounding with Google Search** | Real-time web search during analysis | Validates technical specs, finds related tutorials, fact-checks |
| 📊 **Structured Output** | JSON Schema validation for all responses | Type-safe, predictable data - no parsing errors |
| 🎤 **Audio Prosody Analysis** | Analyzes tone, pace, volume, emotion from voice input | Evaluates soft skills beyond just words - captures HOW you speak |
| 🧠 **Long Context Window** | 2M token capacity | Processes entire long-form videos without splitting |
| 🎨 **Spatial Understanding** | Analyzes visual demonstrations in DIY videos | Identifies tools, parts, hand movements, safety hazards |
| 🚫 **Educational Content Detection** | Filters out non-educational videos | Ensures quality learning experiences |

### Models Used

| Model | Use Case | Why |
|-------|----------|-----|
| `gemini-3-flash-preview` | Video analysis, Q&A, voice roleplay | Native video understanding, audio analysis with prosody, structured output |
| `gemini-2.5-flash-preview-tts` | Voice synthesis for roleplay | Natural, expressive voices with emotion control |

### Native Video Input

```typescript
// Gemini 3 processes YouTube URLs directly - no upload needed
const response = await ai.models.generateContent({
  model: 'gemini-3-flash-preview',
  contents: [
    { text: systemPrompt },
    { fileData: { fileUri: youtubeUrl } }  // ← Native video input
  ],
  config: {
    tools: [{ googleSearch: {} }],  // Grounding with web search
    responseSchema: LessonPlanSchema,
    responseMimeType: 'application/json'
  }
});
```

### Structured Output Schemas

All API responses use JSON Schema for type-safe parsing:
- `SoftSkillsLessonPlanSchema` - Questions focused on interpersonal skills
- `TechnicalLessonPlanSchema` - Includes parts, tools, build steps
- `ContentWarningSchema` - Detects suspicious, fake, or misleading content
- `EvaluationSchema` - Score, strengths, improvements, rewritten answer

### Content Warning System

The AI analyzes video content for trustworthiness and potential issues:

```typescript
interface ContentWarning {
  hasConcerns: boolean;           // True if any issues detected
  warningType?: 'misinformation' | 'unsafe' | 'suspicious';
  concerns: string[];             // List of specific concerns
  recommendation?: string;        // Suggested action for user
}
```

**Detection Categories**:
- **misinformation** - False claims, pseudoscience, conspiracy theories
- **unsafe** - Dangerous practices, harmful procedures
- **suspicious** - Clickbait, unrealistic claims, fabricated content

---

## 💾 Caching Strategy

### Current: No Caching ❌
Each video analysis makes a fresh API call (~$0.01-0.05 per video).

### Planned: URL-Based Caching ✅

```typescript
// storageService.ts enhancement
interface CachedLesson {
  url: string;
  mode: SkillMode;
  plan: LessonPlan;
  cachedAt: string;
  expiresAt: string;  // 7 days
}

// Cache key: hash(url + mode)
const getCacheKey = (url: string, mode: SkillMode) => 
  `lesson_${btoa(url)}_${mode}`;
```

**Cache invalidation**:
- TTL: 7 days
- Manual: User can force refresh
- Mode change: Different cache per mode

---

## 📤 Export Features

### 1. Markdown Download (No Auth)
```typescript
downloadAsMarkdown(lessonPlan, sessionHistory);
// Downloads: skillsync-video-title.md
```

### 2. Google Docs Export (Requires OAuth)
```typescript
const { documentUrl } = await exportToGoogleDocs(plan, accessToken);
window.open(documentUrl, '_blank');
```

**Required OAuth Scopes**:
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/spreadsheets`

### 3. Google Sheets (Parts List)
```typescript
const { spreadsheetUrl } = await exportPartsToGoogleSheets(technicalPlan, accessToken);
```

### 4. Unified Export Modal (v0.8.0)

The `ExportModal` component provides a unified export experience across all learning modes:

```
┌─────────────────────────────────────────────────┐
│  📥 Export Session                              │
├─────────────────────────────────────────────────┤
│  [Select All] [Clear All]                       │
│                                                 │
│  ☑ 📋 Summary - Video summary and skills       │
│  ☑ 📝 Personal Notes - Your session notes      │
│  ☐ 📦 Parts List - 12 components (technical)   │
│  ☐ 🛠️ Tools - 8 tools required (technical)     │
│  ☐ 📐 Build Steps - 15 instructions (technical)│
│  ☐ ❓ Q&A Questions - 5 practice questions     │
│  ☐ ✍️ Your Answers - 3 answered with scores    │
│  ☐ 💬 Chat History - 10 messages               │
│                                                 │
├─────────────────────────────────────────────────┤
│  [Download .md]  [Google Docs]  [Parts→Sheets] │
└─────────────────────────────────────────────────┘
```

**Features:**
- Mode-aware section visibility (technical-only sections hidden for soft skills)
- Selectable content sections for customized exports
- Multiple export formats: Markdown, Google Docs, Google Sheets (parts only)
- Accessible via navbar Export button when lesson plan exists

---

## 🎙️ Voice Roleplay Design

### Use Case
User practices communication scenarios by speaking with Gemini in character. The system analyzes vocal prosody (tone, volume, pace, emotion) to provide realistic soft skills practice.

### Architecture (Turn-Based)

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Browser   │────▶│  MediaRecorder  │────▶│  Gemini 3 Flash │
│  Microphone │     │  (audio/webm)   │     │  (Audio Input)  │
└─────────────┘     └─────────────────┘     └─────────────────┘
      │                                              │
      │                                              ▼
      │                                     ┌─────────────────┐
      │                                     │ Prosody Analysis│
      │                                     │ - Tone detection│
      │                                     │ - Volume level  │
      │                                     │ - Speech pace   │
      │                                     │ - Emotion       │
      │                                     └────────┬────────┘
      │                                              │
      │                                              ▼
      │                                     ┌─────────────────┐
      │                                     │  AI Response    │
      │                                     │  with Emotion   │
      │                                     └────────┬────────┘
      ▼                                              │
┌─────────────┐                                     │
│  Speaker    │◀────────────────────────────────────┘
│  (Web TTS)  │  Adjusted rate/pitch for emotion
└─────────────┘
```

### Persona Configuration

```typescript
interface RoleplayPersona {
  id: string;
  name: string;
  description: string;
  voiceStyle: 'professional' | 'casual' | 'assertive' | 'empathetic';
  scenario: string;  // From video context
}

// Example personas from constants.ts
const ROLEPLAY_PERSONAS = [
  { id: 'difficult_client', name: 'Difficult Client', ... },
  { id: 'skeptical_investor', name: 'Skeptical Investor', ... },
  { id: 'resistant_colleague', name: 'Resistant Colleague', ... },
];
```

### Implementation Status

✅ **Completed**: Turn-based voice roleplay with prosody analysis
- Click-to-record interface with 2-minute timer
- Audio captured via MediaRecorder API (audio/webm;codecs=opus)
- Gemini analyzes audio for prosody: tone, volume, pace, emotion
- AI responds with emotional context
- Text-to-Speech output with adjusted prosody (rate/pitch)
- Text chat fallback mode available
- **User-directed conversations**: AI asks what user wants to discuss (not skills/scenarios)
- **Session feedback**: End-of-session qualitative feedback (no numerical scores)
- **Consistent voice**: Same voice persona maintained throughout entire session
- **8-round limit**: Counts user messages, not full exchanges

### Voice Gender Mapping (Gemini TTS API)

| Gender | Voices |
|--------|--------|
| Male | Achird, Algenib, Algieba, Alnilam, Charon, Orus, Puck, Fenrir, Iapetus, Enceladus, Umbriel, Gacrux, Sadaltager |
| Female | Achernar, Aoede, Autonoe, Callirrhoe, Kore, Leda, Zephyr, Erinome, Despina, Laomedeia, Schedar, Pulcherrima, Sulafat, Vindemiatrix, Rasalgethi, Sadachbia |

### Why Turn-Based vs Real-Time?

**Turn-based approach chosen because:**
1. Gemini can analyze actual audio prosody (not just transcription)
2. More reliable evaluation of soft skills performance
3. No WebSocket complexity or connection issues
4. Better for asynchronous processing of emotional context
5. Supports both voice and text modes seamlessly

**Real-time Live API limitations:**
- Only transcribes to text (loses prosody information)
- Cannot analyze tone, volume, or emotional delivery
- Requires persistent WebSocket connection
- ScriptProcessorNode deprecation issues

---

## 🔐 Authentication

### Current: None (Local-first)
- All data in localStorage
- Google OAuth only for export features

### OAuth Flow (for Docs/Sheets)

```typescript
// Using @react-oauth/google
<GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
  <GoogleLogin
    onSuccess={({ credential }) => {
      // credential is JWT with access token
      setAccessToken(credential);
    }}
    scope="https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets"
  />
</GoogleOAuthProvider>
```

### Future: Supabase Migration

```typescript
// storageService.ts already has template
class SupabaseStorageService implements StorageService {
  // Save to Supabase instead of localStorage
  // Enable cross-device sync
  // User accounts with Google SSO
}
```

---

## 📊 Question Quality Improvement

### Current Issues
- Questions may be too generic
- Not all video sections covered
- Timestamps may be imprecise

### Improvements Planned

1. **Better Prompting**:
   ```
   - Generate questions at NATURAL pause points (speaker pauses, topic transitions)
   - Cover ALL major topics in the video, not just the first few
   - Include mix of question types: prediction, diagnostic, synthesis
   - Each question should test a SPECIFIC skill or concept
   ```

2. **Two-Pass Analysis**:
   - Pass 1: Get video outline with all topics
   - Pass 2: Generate questions for each topic

3. **User Feedback Loop**:
   - "Was this question helpful?" → Improve prompts

---

## 🔗 NotebookLM Compatibility

### What is NotebookLM?
Google's AI research assistant that ingests sources and answers questions.

### Integration Options

| Approach | Feasibility | Notes |
|----------|-------------|-------|
| Direct API | ❌ No public API | NotebookLM has no developer API |
| Export compatible format | ✅ Possible | Export as Google Doc, user imports to NotebookLM |
| Link sharing | ⚠️ Limited | User manually adds video URL to NotebookLM |

### Recommended Approach
Add "Open in NotebookLM" button that:
1. Exports session to Google Doc
2. Shows instructions: "Add this doc to your NotebookLM notebook"

---

## 🚀 Deployment Plan

### Development
```bash
npm run dev  # Vite dev server on :3001
```

### Production
```bash
npm run build  # Output to dist/
# Deploy to Vercel/Netlify (static hosting)
```

### Environment Variables
```env
VITE_GEMINI_API_KEY=xxx              # Required - Gemini API key
VITE_GOOGLE_CLIENT_ID=xxx            # Required for Google Docs export
VITE_GOOGLE_TTS_API_KEY=xxx          # Optional - Google Cloud TTS (for better voice)
```

### Setting Up Google Cloud Text-to-Speech (Optional)

**For professional-quality voice output in roleplay:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Cloud Text-to-Speech API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Restrict the API key to Text-to-Speech API only (recommended)
6. Copy the API key to `.env.local` as `VITE_GOOGLE_TTS_API_KEY`

**Pricing**: ~$4 per 1 million characters (Neural2 voices)
- Typical roleplay response: 100-200 characters
- Cost per response: ~$0.0004-0.0008 (less than 1/10th of a cent)
- Very affordable for hackathon demo

**Without API key**: Falls back to free browser TTS (lower quality)

### Setting Up Google OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the **Google Docs API** and **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Add authorized JavaScript origins:
   - `http://localhost:5173` (for dev)
   - Your production domain
7. Copy the Client ID to `.env.local` as `VITE_GOOGLE_CLIENT_ID`

---

## 📈 Hackathon Judging Criteria

| Criteria | Weight | Our Strategy |
|----------|--------|--------------|
| Technical Execution | 40% | Native Gemini 3 video input, structured output, voice API |
| Innovation | 30% | Interactive video learning, roleplay practice |
| Impact | 20% | Learning outcomes, accessibility |
| Presentation | 10% | 3-min demo video, polished UI |

---

## 🐛 Known Issues & TODOs

### Critical Bugs (Blocking)
- [x] ~~**TypeScript Errors in InteractionPanel.tsx**: Type narrowing issue with `AppMode` enum comparisons~~ (v0.9.0)
- [x] ~~**Deprecated InteractionPanel**: Still used as fallback in App.tsx despite LearningPanel being the primary component~~ (v0.9.0)

### Bugs
- [ ] YouTube Shorts may have playback issues in some browsers
- [ ] Long videos (>30min) may timeout on analysis
- [ ] Mobile responsive improvements

### Code Quality Issues (Identified in v0.9.0 Review)
- [x] ~~`InteractionPanel.tsx` has stale type definitions - missing `EVALUATING` and `LOADING_PLAN` from mode prop~~ (v0.9.0)
- [x] ~~Duplicate code between InteractionPanel and LearningPanel~~ (v0.9.0 - removed InteractionPanel)
- [x] ~~`any` types used in multiple places in geminiService.ts~~ (v0.9.0)
- [x] ~~Missing null safety checks in several components~~ (v0.9.0)
- [ ] Console.log statements should use debug logging utility consistently
- [ ] Missing loading states for some async operations

### Architecture Improvements
- [x] ~~Remove InteractionPanel.tsx and rely solely on LearningPanel~~ (v0.9.0)
- [x] ~~Consolidate shared types into proper interfaces~~ (v0.9.0)
- [ ] Consider using React Query/SWR for API state management
- [ ] Add proper error boundary around each major section

### TODOs
- [x] ~~Create nodes and trees or flow charts about how each knowledge points are interconnected~~ (v0.7.0 - KnowledgeGraph)
- [x] ~~Add progress persistence (resume sessions)~~ (v0.7.0 - progressStorage)
- [x] ~~Integrate unified LearningPanel into App.tsx~~ (v0.7.0 - replaced 3 panels with 1)
- [x] ~~Complete code review and cleanup~~ (v0.9.0) 
---

## 📝 Changelog

### v0.9.1 (2026-01-28) - Voice Roleplay Improvements
- **User-Directed Conversations** (`hooks/useVoiceRoleplay.ts`):
  - AI opening line now asks what user wants to discuss naturally
  - Removed explicit mentions of "skills", "practice", "session", "scenario"
  - Examples: "What brings you to my office today?" vs "What skill would you like to practice?"
- **Removed Approaching Limit Notifications**:
  - Deleted "Approaching conversation limit" warnings for both voice and text modes
  - Cleaner UX without disruptive mid-session notifications
- **End-of-Session Feedback** (`hooks/useVoiceRoleplay.ts`, `components/VoiceRoleplay.tsx`):
  - New "Get Session Feedback" button appears when 8 rounds completed
  - Generates qualitative text feedback (no numerical scores)
  - Feedback sections: "What You Did Well", "Areas to Explore", "Connection to Video Content", "Overall Reflection"
  - Scrollable feedback container with max-height for long content
- **Voice Consistency Fix** (`services/geminiService.ts`, `hooks/useVoiceRoleplay.ts`):
  - Fixed voice changing between rounds (male → female issue)
  - `sessionVoice.current` now always used, never falls back to emotion-based selection
  - Added fallback initialization in `generateTTSAudio` and `textToSpeechWithEmotion`
- **Voice Gender Mapping** (`services/geminiService.ts`):
  - Updated `selectVoiceForPersona()` with correct Gemini TTS API voice genders
  - Male voices: Achird, Alnilam, Charon, Orus (was incorrectly using Achird for females)
  - Female voices: Kore, Aoede, Erinome, Sulafat
  - Added CEO, officer, director detection for professional personas
- **Round Counter Fix** (`hooks/useVoiceRoleplay.ts`):
  - Rounds now count user messages sent, not full exchanges
  - Increment moved to when user message is added (before AI response)
  - Both voice and text modes now properly increment rounds
- **Session Feedback UI** (`components/VoiceRoleplay.tsx`):
  - Added `max-h-64 overflow-y-auto` for scrollable feedback content
  - Sticky header stays visible while scrolling feedback

### v0.9.0 (2026-01-27) - Code Review & Cleanup
- **Removed Deprecated Components**:
  - Deleted `InteractionPanel.tsx` (745 lines) - legacy fallback replaced by LearningPanel
  - Deleted `TechnicalPanel.tsx` (623 lines) - consolidated into LearningPanel
  - Deleted `OthersPanel.tsx` (90 lines) - consolidated into LearningPanel
  - Total: ~1,458 lines of dead code removed
- **Fixed TypeScript Errors**:
  - Resolved type narrowing issue with `AppMode` enum comparisons in InteractionPanel
  - Root cause: InteractionPanel was receiving subset of AppMode types but checking for excluded values
  - Fix: Replaced InteractionPanel fallback with inline loading state component
- **Improved Loading State UI**:
  - New loading component in App.tsx shows "Analyzing Video..." with animated progress indicators
  - Better UX during Gemini API analysis phase
  - Shows step-by-step progress: "Analyzing content", "Generating questions", "Creating study plan"
- **Enhanced utils.ts**:
  - Added `parseTimestamp()` - convert MM:SS back to seconds
  - Added `isValidYouTubeUrl()` - validate YouTube URL format
  - Added `getScoreLabel()` - human-readable score labels (Excellent, Great, Good, etc.)
  - Added `safeJsonParse()` - safe JSON parsing with fallback
  - Added `generateId()` - UUID generation wrapper
  - Added `sanitizeFilename()` - remove invalid filename characters
  - Added `sleep()` - promise-based delay utility
  - Added `clamp()` - clamp number between min/max
  - Fixed `any` type in `debounce()` - now uses `unknown`
  - Added null safety checks to `formatTimestamp()`, `renderMarkdown()`, `truncateText()`
- **Architecture Improvements**:
  - LearningPanel is now the sole panel component for all modes
  - Cleaner separation of concerns: App.tsx handles state, LearningPanel handles UI
  - Reduced import complexity in App.tsx

### v0.8.0 (2026-01-26) - Unified Export & Completion Fixes
- **ExportModal Component** (`components/ExportModal.tsx`):
  - Unified export modal for all learning modes
  - Selectable content sections: Summary, Notes, Parts, Tools, Steps, Design, Q&A, Session History, Chat
  - Mode-aware sections (technical sections hidden for soft skills mode)
  - Export formats: Download Markdown, Google Docs, Google Sheets (parts list)
  - Accessible via navbar "📥 Export" button when lesson plan exists
- **Completion Flow Fixes**:
  - Technical and Others modes now go directly to `COMPLETED` state after Q&A
  - Study Pack generation only for Soft Skills mode
  - Added `COMPLETED`, `PACK_READY`, `GENERATING_PACK` to LearningPanel conditions
  - QATab shows completion banner with session summary when all questions answered
- **OthersLessonPlan Type** (`types.ts`):
  - Added new `OthersLessonPlan` interface for 'others' mode
  - Added `isOthersPlan()` type guard
  - Fixed type error when assigning 'others' mode

### v0.7.3 (2026-01-27) - Timestamp Validation & Model Updates
- **Fixed Invalid Timestamp Issue** (`services/geminiService.ts`, `App.tsx`):
  - Bug: Q&A stop points could have timestamps exceeding video duration (e.g., 3:50 for a 2:41 video)
  - Root cause: Gemini was generating timestamps without strict bounds checking
  - Fix: Added `videoDurationSeconds` field to schemas (now required)
  - Fix: Updated prompts to emphasize determining video duration FIRST
  - Fix: Added explicit instructions that ALL timestamps must be < videoDurationSeconds
  - Fix: Added post-processing validation in App.tsx to filter out invalid timestamps as safety net
- **Model Constants Update** (`constants.ts`):
  - Fixed extra tab characters in model names for `live` and `pro`
  - Models now: `gemini-3-flash-preview`, `gemini-live-2.5-flash-preview-native-audio-09-2025`, `gemini-3-pro-preview`
  - SkillSync uses Gemini 3 models (flash-preview) for all video analysis as required for hackathon

### v0.7.2 (2026-01-26) - Mode Detection State Fix
- **Fixed Stale Panel Issue** (`App.tsx`):
  - Bug: After "New Video" and entering a technical video URL, the soft-skills panel persisted even though mode was correctly detected as "Technical"
  - Root cause 1: A `useEffect` hook was auto-calling `loadLesson` whenever `videoId` changed, bypassing the detection flow and using stale `skillMode`
  - Root cause 2: `loadLesson` used `skillMode` from closure which could be stale due to React's async state updates
  - Fix: Removed the problematic `useEffect` that auto-loaded on videoId change
  - Fix: Added `overrideMode` parameter to `loadLesson(id, forceRefresh, overrideMode?)` 
  - Fix: All `loadLesson` calls now pass mode explicitly to avoid closure timing issues
  - Proper flow now: `handleUrlSubmit` → detection → `handleConfirmMode` → `loadLesson(id, false, skillMode)`

### v0.7.1 (2026-01-25) - Auto-Detection & Mode Override Flow
- **Auto-Detect Video Category** (`services/geminiService.ts`):
  - New `detectVideoMode()` exported function for lightweight category detection
  - Returns `{ mode, confidence, reasoning }` for soft/technical/others
  - Runs before full lesson plan generation
  - Uses Gemini 3 flash model for fast detection
- **New App States** (`types.ts`):
  - Added `DETECTING_MODE`: Shows spinner while detecting category
  - Added `MODE_DETECTED`: Shows detected mode with confirmation UI
- **Mode Detection Flow** (`App.tsx`):
  - User submits URL → Auto-detect runs → Shows detected mode
  - User can override detected mode before proceeding
  - "Auto-detected" badge with confidence % or "User override" badge
  - Shows reasoning from AI (e.g., "Detected hands-on technical tutorial")
- **Smart Cache Handling**:
  - Checks all three mode caches on URL submit
  - If cached plan exists, skips detection and uses cached mode
  - Shows cache indicator when cached plan available for selected mode
  - "Force re-analyze" option to bypass cache
  - Button changes: "Load Cached Lesson →" vs "Analyze & Start →"
- **User Override Support**:
  - User can switch mode after auto-detection
  - System tracks `isUserOverride` state
  - Shows cache status when switching to modes with/without cache

### v0.7.0 (2026-01-25) - Unified Panel & Progress Persistence
- **Unified LearningPanel Component** (`components/LearningPanel.tsx`):
  - Consolidates TechnicalPanel, InteractionPanel, and OthersPanel patterns
  - Single component handles all three learning modes (technical, soft, others)
  - Shared tab navigation with mode-specific content
  - Reduces code duplication across panels
  - Common header with dynamic badges based on mode
  - Shared Notes and Chat tabs for all modes
  - Mode-aware tab configuration (shows relevant tabs per mode)
  - **Now integrated into App.tsx** - replaces old panel switching logic
  - Uses `lessonPlan.mode` as source of truth (not the user-selected `skillMode`)
- **Knowledge Graph Visualization** (`components/KnowledgeGraph.tsx`):
  - New Graph tab shows concept interconnections from lesson plan
  - Extracts skills, components, tools, steps, and questions as nodes
  - Shows relationships between concepts as edges
  - Grid view for browsing by category, List view for linear exploration
  - Click nodes to see details and connections
  - Jump to video timestamp for timestamped concepts
  - Visual legend with color-coded concept types
- **Progress Persistence** (`services/storageService.ts` - `progressStorage`):
  - Auto-saves learning session state to localStorage
  - Saves: video URL, lesson plan, current question, answered questions, session history
  - Resume prompt on app load when saved progress exists
  - Shows summary: mode, questions answered, save timestamp
  - "Resume" to continue session, "Start Fresh" to clear and start new
  - 7-day TTL on saved progress
  - Progress cleared on explicit "Start Over"
  - Updates saved progress on every state change

### v0.6.5 (2026-01-25) - UI Polish
- **ModeSelector Cleanup**:
  - Removed outdated "(auto-detected from video)" label since auto-detection was disabled
  - Changed "Auto-detect from video" dropdown option to contextual "Select a scenario/project type..." placeholder
- **TechnicalPanel Tab Improvements**:
  - Fixed tab text truncation issue where labels were hidden on smaller screens
  - Tab labels now always visible with improved padding and styling
  - Active tab now has subtle white background highlight
  - Hover states improved for better accessibility
  - Badge count only shows when count > 0
  - Added title attribute for tooltip on hover

### v0.6.4 (2026-01-25) - Mode Switching & Chat Export
- **Mode Switching Improvements**: Complete redesign of mode change flow
  - Removed auto-detection system that caused API overload (503 errors)
  - User-selected mode is now always respected (no more auto-override)
  - Added confirmation modal when switching modes mid-session
  - Modal warns about progress loss and prompts to save before switching
  - App resets to IDLE after mode change to let user re-enter video
  - Prevents multiple API calls and ensures clean state
  - "Start Over" button now disabled during video loading and regeneration
- **Chat Export Feature**: Export chat conversations to Markdown and Google Docs
  - Export button appears in chat header when messages exist
  - **Download .md**: Instant download with formatted chat history
  - **Export to Google Docs**: Opens in new tab with OAuth (same flow as lesson exports)
  - Both formats include mode label (💬 Discussion or 🎭 Roleplay)
  - Includes message count, timestamps, and role labels (👤 You / 🤖 AI)
  - Clean formatting with dividers between messages
  - Integrated with existing Google OAuth infrastructure
- **Cache Improvements**: Fixed cache to respect user-selected mode
  - Cache key now based on user selection, not auto-detected mode
  - Switching modes properly generates new content instead of returning cached wrong mode
  - Each mode (soft/technical/general) has separate cache entry per video

### v0.7.0 (2026-01-25) - Architecture Refactoring
- **Unified LearningPanel**: Replaced 3 separate panel components with single unified component
  - `InteractionPanel.tsx` (790 lines) + `TechnicalPanel.tsx` (623 lines) + `OthersPanel.tsx` (90 lines) → `LearningPanel.tsx` + shared components
  - ~30% code reduction through elimination of duplicated logic
  - Mode differences now handled via configuration object, not conditionals
- **Shared Component Extraction**: Created reusable components
  - `QASection.tsx` - Unified Q&A logic used by Soft Skills and Technical modes
  - `FeedbackDisplay.tsx` - Score visualization, strengths/improvements (extracted from both panels)
  - `PanelHeader.tsx` - Mode-aware header with badges and summary
  - `PanelTabs.tsx` - Tab navigation with icons, counts, active state
  - `TabButton.tsx` - Single tab button component
  - `Badge.tsx` - Reusable badge for labels/tags
- **Utility Functions**: Created `utils.ts` for shared helpers
  - `formatTimestamp(seconds)` - MM:SS formatting (was duplicated 4 times)
  - `copyToClipboard(text)` - Clipboard with success callback
  - `renderMarkdown(text)` - Markdown to HTML conversion
- **Configuration-Driven Modes**: Declarative mode definitions
  - Each mode defines tabs, features, badges via config object
  - Easy to add new modes without duplicating panel code
  - Banner components passed as config, not hardcoded
- **Technical Mode Fixes**: Q&A feedback now properly displays in Technical mode
  - Evaluation results (score, strengths, improvements) visible after submission
  - Fixed mode prop propagation to QASection
- **Mode Auto-Regeneration**: Switching modes now auto-regenerates lesson plan
  - useEffect watches `skillMode` and `selectedPreset` changes
  - No need to manually click "New Questions" after mode switch

### v0.6.3 (2026-01-25)
- **General Content Mode ("Others")**: Added third learning mode for videos without clear educational classification
  - Videos that don't fit Soft Skills or Technical categories are now classified as "General Content"
  - Instead of rejecting videos, users can still interact with Notes and Chat tools
  - Warning banner explains the video wasn't classified as structured educational content
  - Provides graceful fallback for edge cases and AI misclassifications
  - Mode selector now has three options: Soft Skills, Technical, General
- **Tab Overflow Fix**: Improved tab UI for better mobile and desktop experience
  - Technical mode tabs (8 total) now use scrollable horizontal layout
  - Responsive text sizing (smaller on mobile, normal on desktop)
  - Tabs use `flex-shrink-0` to prevent squishing
  - Better spacing and padding adjustments
- **Mode Selector UI**: Updated to support three modes with wrapping
  - Mode buttons wrap to multiple lines if needed
  - Preset dropdown hidden for General Content mode (not applicable)
  - Better responsive behavior on small screens
- **Detection Logic Improvement**: More lenient with visual-only tutorials
  - Updated prompts to recognize cooking demos, crafts without narration
  - Silent how-to videos now classified instead of rejected
  - Users can always override by selecting a mode before loading

### v0.6.2 (2026-01-25)
- **Tab State Persistence**: Fixed state reset bug when switching between Q&A, Notes, and Chat tabs
  - All tabs now stay mounted (using CSS `hidden` instead of conditional rendering)
  - Chat messages, notes content, and input fields preserved when switching tabs
  - Same fix applied to both InteractionPanel and TechnicalPanel
- **Video Display Enlargement**: Increased video area from 5 to 7 columns (out of 12-column grid)
  - Video now takes ~58% of width instead of ~42%
  - Better viewing experience for tutorials and demonstrations
  - Interaction panel adjusted to 5 columns
- **Safety Banner Persistence**: Fixed banner disappearing issues in Technical Mode
  - Removed auto-play for technical projects (users must manually start)
  - TechnicalPanel now visible in PLAN_READY, PLAYING, and PAUSED_INTERACTION modes
  - Safety banner remains visible until user acknowledges
  - Soft skills mode still auto-plays after 1.5 seconds
- **Technical Mode Feature Parity**: Added Q&A, Notes, and Chat tabs to Technical Mode
  - Technical projects now have 8 tabs: Overview, Parts, Tools, Steps, Why?, Q&A, Notes, Chat
  - Same interactive learning features as Soft Skills mode
  - Chat focuses on technical discussion (no roleplay option)
  - Q&A tab shows comprehension questions with video timestamps
  - All tab states preserved when switching (same as Soft Skills mode)
- **Start Over Fix**: Proper state reset instead of page reload
  - "Start Over" button now resets all state programmatically
  - Skill mode resets to default 'soft' instead of persisting previous selection
  - No more loading from localStorage on reset
  - Cleaner user experience when starting with new video

### v0.6.1 (2026-01-24)
- **Voice Roleplay Refactor**: Complete redesign from Live API to turn-based prosody analysis
  - Changed from "hold to speak" to click-to-start/stop recording
  - Added 2-minute recording timer with countdown display
  - Gemini now analyzes actual audio for tone, volume, pace, emotion
  - AI responses include emotional context
  - TTS output adjusted for emotional prosody (rate/pitch modulation)
  - Messages display prosody analysis and emotional tone
  - More reliable than WebSocket-based real-time approach
  - Better soft skills evaluation through true audio analysis
- **Dynamic Scenario Switching**: Scenario dropdown now updates roleplay context in real-time
  - Change scenario without re-analyzing the video
  - Experiment with different roleplay contexts instantly
  - Selected scenario overrides auto-detected scenario from video analysis
- **Conversation Round Limiting**: Added 8-round maximum for structured practice
  - Prevents endless conversations
  - Shows round counter (e.g., "Round 3/8")
  - Warning when approaching limit
  - Automatic session completion at 8 exchanges
  - Encourages focused, goal-oriented practice
- **Google Cloud Text-to-Speech Integration**: Professional-quality voice with SSML prosody
  - Neural2 voices for natural-sounding speech
  - **Automatic gender detection**: Analyzes persona description for gender pronouns
    - Male personas (he/him/man/Mr.) → Male voice (en-US-Neural2-J)
    - Female personas (she/her/woman/Ms.) → Female voice (en-US-Neural2-F)
    - Browser TTS fallback also respects gender detection
  - SSML-based prosody control (rate, pitch, volume) based on emotion
  - Automatic fallback to browser TTS if API key not configured
  - Cost: ~$4 per 1 million characters (very affordable)
  - Emotions mapped to specific prosody patterns:
    - Impatient/Frustrated: faster rate, higher pitch
    - Grateful/Friendly: slower rate, warm pitch
    - Angry/Dismissive: loud volume, lower pitch
    - Skeptical/Curious: measured pace, slight pitch drop
  - Setup: Add `VITE_GOOGLE_TTS_API_KEY` to `.env.local`
- **Text Chat Fix**: Resolved closure bug where user messages weren't included in conversation history

### v0.6.0 (2026-01-23)
- **Sticky Tabs**: Q&A, Notes, and Chat tabs now stay visible while scrolling
  - Tabs use `sticky top-0 z-10` positioning
  - Discuss Video and Roleplay sub-tabs also sticky
  - Improved navigation experience
- **Dynamic Mode Switching**: Users can now change between Soft Skills and Technical modes after loading a video
  - Mode selector always visible in navbar
  - Prompts for confirmation before reloading lesson plan
  - Useful for videos that cover both types of content
- **Unified Notes Section**: Redesigned notes UI with single area
  - User notes always visible and editable
  - AI-generated notes show/hide with toggle button
  - AI notes only generate when user clicks button (not automatic)
  - Collapsible AI notes section above user notes
  - Auto-save for user notes preserved
- **Voice Roleplay Integration**: Voice chat now accessible from Roleplay tab
  - "Start Voice Roleplay" button in Roleplay chat mode
  - Opens VoiceRoleplay modal with full voice capabilities
  - Text chat fallback available in same interface
  - Full persona and scenario descriptions visible
- **Content Filtering**: Chat limited to video-related topics only
  - System prompt enforces discussion about video content
  - Redirects off-topic questions back to learning material
- **Markdown Rendering**: Chat messages now properly render markdown
  - `**bold**`, `*italic*`, `` `code` `` display correctly
  - No more raw markdown syntax showing in messages
- **URL Input Improvement**: Video URL input now trims whitespace automatically
  - Prevents errors from accidental spaces when pasting

### v0.5.1 (2026-01-22)
- **Legal Compliance**: Added Privacy Policy, Terms of Service, and AI Disclaimer
  - First-time user consent modal requiring acceptance of all terms
  - Clear AI-generated content warnings
  - Persistent consent stored in localStorage
  - Footer with links to legal pages and AI warning
- Added `/terms` and `/privacy` routes for legal pages
- Added `DisclaimerModal` component with checkbox consent flow

### v0.5.0 (2026-01-22)
- **Voice Roleplay**: Full implementation with Gemini Live API
  - Real-time bidirectional voice conversation
  - Push-to-talk interface with visual feedback
  - AI plays roleplay persona based on video context
  - Text fallback mode available
  - Automatic feedback at end of conversation
- Added `useVoiceRoleplay` hook for WebSocket management
- Added `VoiceRoleplay` component with modal UI

### v0.4.1 (2026-01-22)
- **Question navigation**: Added Previous/Next buttons to navigate between questions
- **Progress dots**: Visual indicator showing all questions with answered status
- **Video seek on question click**: Clicking any question seeks video to that timestamp
- **Answered badges**: Shows checkmarks on answered questions in navigation

### v0.4.0 (2026-01-22)
- **Dynamic question count**: Number of questions based on video length and content density
- **Question types system**: 10 question types based on Bloom's taxonomy
- **Answered questions storage**: Persists Q&A history per video for 30 days
- **Skip answered toggle**: Focus on unanswered questions only
- **Regenerate questions**: Generate different questions for the same video
- **Question type badges**: Visual indicator of question type in UI

### v0.3.1 (2026-01-22)
- Export buttons (Markdown, Google Docs) now visible in lesson plan view from the start
- Users can export at any time, not just after completing all questions

### v0.3.0 (2026-01-22)
- Added question-specific scoring criteria (video/question-dependent rubrics)
- Wired up Google Docs export with OAuth flow
- Added answer character limit (500 chars) with live counter
- Fixed deprecated `substr` → `slice`
- Fixed evidence timestamp null check

### v0.2.0 (2026-01-21)
- Added clickable timeline markers
- Added click-to-answer on questions
- Added API debug logging
- Fixed YouTube Shorts URL support
- Simplified SafetyBanner (removed arbitrary risk levels)

### v0.1.0 (2026-01-20)
- Initial implementation
- Soft skills and technical modes
- Basic Q&A flow
- Markdown export

---

## 🤝 Contributing

This is a hackathon project. After the competition, we may open source it.

---

*Built for Google Gemini 3 Hackathon 2026*
