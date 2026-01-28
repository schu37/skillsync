# SkillSync
2026 Gemini 3 Hackathon Project
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run it

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js

1. Copy .env.example into .env.local and Set the environment variables with your Gemini API key. Your API keys need access to models below:

      flash: 'gemini-3-flash-preview',

      flashPreview: 'gemini-3-flash-preview',

      live: 'gemini-live-2.5-flash-preview-native-audio-09-2025', 

      pro: 'gemini-3-pro-preview',

      tts: 'gemini-2.5-flash-preview-tts'

2. Install dependencies:
   `npm install`
3. Run the app:
   `npm run dev`
4. Open [http://localhost:3001](http://localhost:3001) in your browser to see the result.

# Bugs:
# As of Jan 28, 2026:

- I did not charge too much for the Gemini APIs. Therefore, models may exceed my budget if you use the SkillSync website. Many functions will show errors if that happens.

- You may need to manually click re-analyze videos if a video is wrongly categorized or you want to try different categories on the same video (soft, technical, general).

- Local storage may be invalid if you delete browser cookies.

- Voice roleplay may have delayed responses in the 8 rounds of conversation.

- After the regeneration of the question in Q&A, question markers on the video timeline might be inaccurate.

- Caching issue for the progress of the same URL; The progress of a certain learning panel may not be saved.
