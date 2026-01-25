# SkillSync Architecture & Design Document

> **Last Updated**: January 21, 2026  
> **Version**: 0.2.0  
> **Hackathon**: Google Gemini 3 Devpost ($100K Prize Pool)  
> **Deadline**: Jan 30, 2026

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
│   ├── InteractionPanel.tsx # Q&A, Notes, Chat tabs (soft skills mode)
│   ├── ModeSelector.tsx    # Soft/Technical/General mode toggle
│   ├── TechnicalPanel.tsx  # Overview, Parts, Tools, Steps, Why?, Q&A, Notes, Chat (technical mode)
│   ├── OthersPanel.tsx     # Notes, Chat for unclassified videos (general mode)
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
| **Sticky Tabs** | ✅ Done | P1 | Q&A/Notes/Chat tabs always visible |
| **Mode Switching** | ✅ Done | P1 | Change soft/technical after video load |
| **Unified Notes** | ✅ Done | P1 | Single notes area with AI toggle |
| **Tab State Persistence** | ✅ Done | P1 | Switching tabs preserves content |
| **Technical Mode Parity** | ✅ Done | P1 | Q&A, Notes, Chat in technical mode |
| **Safety Banner Persistence** | ✅ Done | P1 | No auto-play for technical projects |
| **Mode Switching** | ✅ Done | P1 | Change soft/technical after video load |
| **Unified Notes** | ✅ Done | P1 | Single notes area with AI toggle |
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

### Bugs
- [ ] YouTube Shorts may have playback issues in some browsers
- [ ] Long videos (>30min) may timeout on analysis
- [x] ~~Implement voice roleplay with prosody analysis~~
- [x] ~~Add typing chat about the video with gemini~~
- [x] ~~Make tabs sticky and always visible~~
- [x] ~~Allow mode switching after video load~~
- [x] ~~Unify notes section with AI toggle~~
- [x] ~~Fix tab state reset when switching between tabs~~
- [x] ~~Add Q&A, Notes, Chat to Technical Mode~~
- [x] ~~Fix Safety Banner persistence and auto-play~~
- [x] ~~Fix Start Over to reset skill mode properly~~
- [ ] Add progress persistence (resume sessions)
- [ ] Mobile responsive improvements
- [ ] Create nodes and trees or flow charts about how each knowledge points are interconnected
- [ ] Add progress persistence (resume sessions)
- [ ] Mobile responsive improvements

### TODOs
- [ ] Create nodes and trees or flow charts about how each knowledge points are interconnected. 
---

## 📝 Changelog

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
