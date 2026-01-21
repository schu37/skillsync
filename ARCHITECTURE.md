# SkillSync Architecture & Design Document

> **Last Updated**: January 21, 2026  
> **Version**: 0.2.0  
> **Hackathon**: Google Gemini 3 Devpost ($100K Prize Pool)  
> **Deadline**: February 10, 2026

---

## 🎯 Product Vision

**SkillSync** transforms passive video watching into active learning through AI-powered interactive practice sessions. Users paste a YouTube URL, and Gemini 3 analyzes the video to generate contextual questions, provide real-time feedback on answers, and enable voice-based roleplay for communication skills practice.

### Core Value Proposition
- **For Soft Skills**: Practice negotiation, communication, leadership through roleplay
- **For Technical Skills**: Learn DIY/maker projects with parts lists, build instructions, and safety guidance

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  App.tsx    │  │ VideoPlayer │  │ Interaction │              │
│  │  (Router)   │  │ (YouTube)   │  │   Panel     │              │
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

## 📁 File Structure

```
Skillsync/
├── index.html              # Entry point
├── index.tsx               # React mount
├── App.tsx                 # Main app component, state management
├── types.ts                # TypeScript interfaces
├── constants.ts            # App configuration, presets
├── vite.config.ts          # Vite + env vars
├── tsconfig.json           # TypeScript config
├── package.json            # Dependencies
├── .env.local              # API keys (gitignored)
├── .env.example            # Template for env vars
├── ARCHITECTURE.md         # This file
│
├── components/
│   ├── VideoPlayer.tsx     # YouTube iframe + timeline markers
│   ├── InteractionPanel.tsx # Q&A interaction, lesson plan view
│   ├── ModeSelector.tsx    # Soft/Technical mode toggle
│   ├── TechnicalPanel.tsx  # Parts, tools, build steps (technical mode)
│   ├── SafetyBanner.tsx    # Disclaimer for technical projects
│   └── VoiceRoleplay.tsx   # [TODO] Voice conversation UI
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

## 🔑 Key Features & Status

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Video Analysis (Gemini 3) | ✅ Done | P0 | Native YouTube URL input |
| Stop Point Questions | ✅ Done | P0 | 3-7 questions per video |
| Answer Evaluation | ✅ Done | P0 | Score, strengths, improvements |
| Soft Skills Mode | ✅ Done | P0 | Communication, negotiation |
| Technical Skills Mode | ✅ Done | P0 | Parts list, build steps |
| Timeline Markers | ✅ Done | P1 | Clickable to seek |
| Question Click-to-Answer | ✅ Done | P1 | Jump to any question |
| API Logging (Debug) | ✅ Done | P1 | Console group logs |
| **Video Caching** | ✅ Done | P1 | 7-day TTL, per URL+mode |
| **Markdown Export** | ✅ Done | P1 | Download full session |
| **Google Docs Export** | 🔄 Partial | P1 | Button added, OAuth pending |
| **Voice Roleplay** | 🔄 TODO | P1 | Gemini Live API integration |
| Study Pack Generation | ✅ Done | P2 | Markdown summary |
| Safety Disclaimer | ✅ Done | P2 | User acknowledgment |
| Google Sheets Export | 🔨 Partial | P2 | Parts list export |

---

## 🧠 Gemini API Integration

### Models Used

| Model | Use Case | Why |
|-------|----------|-----|
| `gemini-3-flash-preview` | Video analysis, Q&A | Native video understanding, structured output |
| `gemini-2.0-flash-live-001` | Voice roleplay | Real-time bidirectional audio |

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
- `EvaluationSchema` - Score, strengths, improvements, rewritten answer

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

---

## 🎙️ Voice Roleplay Design

### Use Case
User practices communication scenarios by speaking with Gemini in character.

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Browser   │────▶│  WebSocket  │────▶│  Gemini Live    │
│  Microphone │◀────│  Connection │◀────│  API (2.0)      │
└─────────────┘     └─────────────┘     └─────────────────┘
      │                                         │
      ▼                                         ▼
┌─────────────┐                         ┌─────────────────┐
│   Speaker   │                         │  Roleplay       │
│   Output    │                         │  Persona Config │
└─────────────┘                         └─────────────────┘
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

### Implementation Plan

1. **Phase 1**: Text-based roleplay (type responses)
2. **Phase 2**: Voice input via Web Speech API (already built: `useVoiceInput`)
3. **Phase 3**: Full duplex voice via Gemini Live API

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
npm run dev  # Vite dev server on :3000
```

### Production
```bash
npm run build  # Output to dist/
# Deploy to Vercel/Netlify (static hosting)
```

### Environment Variables
```env
GEMINI_API_KEY=xxx          # Required
GOOGLE_CLIENT_ID=xxx        # For Docs/Sheets export
```

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

### Bugs
- [ ] YouTube Shorts may have playback issues in some browsers
- [ ] Long videos (>30min) may timeout on analysis

### TODOs
- [ ] Add video caching (same URL → reuse results)
- [ ] Wire up "Export to Google Docs" button in UI
- [ ] Implement voice roleplay with Gemini Live API
- [ ] Improve question coverage prompts
- [ ] Add progress persistence (resume sessions)
- [ ] Mobile responsive improvements

---

## 📝 Changelog

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
