# **1\. Updated Technical Docs — SkillSync (AI-Studio-ready)**

## **Product definition (tight)**

**SkillSync** is an interactive learning app that turns **instructional videos** into **guided practice sessions**.

The system:

* Analyzes a video \+ transcript

* Detects teachable skills

* Inserts **timestamped stop points**

* Auto-pauses playback to ask questions

* Evaluates answers with evidence

* Exports a structured study pack

It supports:

* **Soft skills** (negotiation, communication) — primary

* **Technical skills (beta)** — summarization \+ checkpoints only (no unsafe step-by-step)

---

## **Core capabilities (MVP scope)**

### **A. Inputs**

* Video source:

  * YouTube URL (preferred)

  * OR demo/local video placeholder

* Transcript:

  * From YouTube captions

  * OR pasted text (fallback)

* Scenario preset:

  * e.g. “Supplier negotiation”, “Interview”, “Technical build overview”

* Mode:

  * Soft Skills (default)

  * Technical Skills (beta, constrained)

---

### **B. Processing pipeline (agentic, not chat)**

1. **Transcript parsing**

2. **Lesson planning (Gemini)**

   * Detect 1–3 skills

   * Score “learning quality”

   * Generate 3–7 stop points

3. **Practice loop**

   * Play → pause → question → answer → evaluation

4. **Evidence-grounded feedback**

5. **Study pack generation**

---

### **C. Outputs**

#### **1\. Lesson Plan**

* Skills detected

* Learning content score

* Stop points:

  * timestamps

  * context summary

  * question

  * rubric

  * gold answer

  * coach notes

#### **2\. Practice Feedback**

* Score (0–5)

* Strengths

* Improvements

* Improved rewrite

* Evidence quotes \+ timestamps

#### **3\. Study Pack (exportable)**

* Skills summary

* Key takeaways

* Q\&A per stop point

* Personalized drills/checklist

---

## **Soft vs Technical Skills handling**

### **Soft Skills (default)**

* Prediction questions (“What should they say next?”)

* Diagnostic questions (“What went wrong here?”)

* Rewrite coaching

### **Technical Skills (beta, safe)**

* Extract:

  * Parts/tools list (if mentioned)

  * Build phases (high-level)

* Interactive checkpoints:

  * “Which component is connected here?”

* No novel procedural instructions

* Strong safety disclaimers

---

## **Architecture (solo-friendly)**

### **Frontend**

* React \+ TypeScript

* Two-column layout:

  * Left: video player \+ timeline markers

  * Right: tabs (Plan / Practice / Study Pack)

### **Backend**

* Minimal API routes:

  * `/api/plan`

  * `/api/evaluate`

  * `/api/studypack`

* Gemini calls live only in backend

### **State machine**

`IDLE`  
`→ TRANSCRIPT_READY`  
`→ PLANNING`  
`→ PLAN_READY`  
`→ PLAYING`  
`→ PAUSED_FOR_QUESTION`  
`→ EVALUATING`  
`→ FEEDBACK`  
`→ PLAYING`  
`→ COMPLETED`  
`→ PACK_READY`

---

## **Safety & reliability rules (critical for judges)**

* Every question and feedback item must cite transcript evidence

* No step-by-step instructions for dangerous physical activities

* Demo mode must work without YouTube failures

* Strict JSON outputs between backend and frontend

