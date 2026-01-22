# Copilot Instructions for SkillSync

## Project Overview
SkillSync transforms YouTube videos into interactive learning experiences. Built for the Google Gemini 3 hackathon ($100K prize, deadline Feb 10, 2026). Solo developer project.

## Tech Stack
- **Frontend**: React 19 + TypeScript 5.8 + Vite 6
- **AI**: `@google/genai` SDK with `gemini-3-flash-preview` model
- **Auth**: `@react-oauth/google` (OAuth flow)
- **State**: `zustand` for global state
- **Voice**: Web Speech API (SpeechRecognition/SpeechSynthesis)
- **Video**: YouTube IFrame Player API

## Architecture Patterns

### State Machine
App uses `AppMode` enum (12 states) in `types.ts`. Flow: `IDLE → LOADING_PLAN → PLAN_READY → PLAYING ↔ PAUSED_INTERACTION → EVALUATING → FEEDBACK → COMPLETED`

## Repository Source of Truth

- Always consult and update `ARCHITECTURE.md` when making code or architectural changes. Treat `ARCHITECTURE.md` as the canonical design document for the project; ensure code edits are aligned with it and update the document to reflect any changes to architecture, flows, or public behavior.


### Two Learning Modes
- **Soft Skills** (`mode: 'soft'`): Roleplay scenarios for communication, negotiation
- **Technical Skills** (`mode: 'technical'`): DIY builds with parts lists, tools, build steps

### Type Guards
Always use type guards when handling lesson plans:
```typescript
import { isTechnicalPlan, isSoftSkillsPlan } from '../types';
if (isTechnicalPlan(plan)) { /* access plan.components, plan.tools */ }
```

## Key Services

### geminiService.ts
- All Gemini API calls use structured output with JSON schemas
- Use `logApi(label, data)` for debug logging
- YouTube URLs normalized via `normalizeYouTubeUrl()` (handles `/shorts/` too)
- Video analysis uses `fileData.fileUri` with YouTube URL directly

### storageService.ts
- `videoCache.get(url, mode)` / `videoCache.set(url, mode, plan)` - 7-day TTL cache
- `LocalStorageService` implements `StorageService` interface
- Designed for future Supabase migration

### exportService.ts
- `downloadMarkdown(content, filename)` - browser download
- `openInGoogleDocs(content)` - OAuth flow to Docs API

## Component Conventions
- Components in `/components/` folder
- Services in `/services/` folder
- Types in `types.ts`, constants in `constants.ts`
- Use Tailwind classes for styling
- Error boundaries around async operations

## Gemini API Usage
```typescript
const ai = new GoogleGenAI({ apiKey: getApiKey() });
const response = await ai.models.generateContent({
  model: GEMINI_MODELS.flash,
  contents: [{ role: 'user', parts: [...] }],
  config: { responseMimeType: 'application/json', responseSchema: MySchema }
});
```

## Common Gotchas
- Always validate Gemini responses before use (can return null/malformed)
- StopPoints may be null during transitions - add null checks
- Use `extractVideoId()` for parsing YouTube URLs (handles all formats)
- Avoid blocking UI during `EVALUATING` state - show loading indicators

## What's Implemented
✅ Video analysis, lesson plan generation, Q&A flow, caching, exports, timeline markers

## What's Pending
❌ Voice roleplay with Gemini Live API, full Google OAuth flow
