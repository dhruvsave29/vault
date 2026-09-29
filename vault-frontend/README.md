
# CogniStream 

![CogniStream Banner](/public/hero-diagram.png)

> **Ambient cognitive monitoring through passive kinematic telemetry. No tests. No anxiety. Just data.**

**Built by Team Paradigm for the COHERENCE Hackathon (Healthcare Track)**

---

## 🛑 The Problem Statement

Current clinical cognitive tests (like MoCA or MMSE) are fundamentally flawed for early detection. They are:
1.  **Stressful & Active:** They require the patient to sit in a clinical setting and actively solve puzzles, causing "white coat syndrome" and anxiety.
2.  **Infrequent:** They are only conducted once every 6-12 months.
3.  **Too Late:** By the time a patient fails a clinical test, severe cognitive decline (Dementia, Alzheimer's, Parkinson's) has already occurred. 

## 💡 Our Proposed Solution

**CogniStream** is an invisible safety net. It provides zero-friction, ambient monitoring of a patient's cognitive health by analyzing **how** they type on their everyday devices, not **what** they type. 

By running quietly in the background, we continuously analyze kinematic metadata (physics-based typing patterns) to detect the earliest micro-signs of cognitive friction months before clinical symptoms appear.

### The Physics of Decline
We track three core kinematic markers:
*   **Flight Time:** The delay (in milliseconds) between releasing one key and pressing the next. An increasing gap indicates micro-hesitations and cognitive friction.
*   **Dwell Time:** How long a single key is held down. Minute changes indicate creeping shifts in fine motor control.
*   **Correction Frequency:** An erratic frequency of backtracking (backspaces) signals short-term memory blips or confusion.

**Total Privacy:** CogniStream ignores the content. Letters are hashed or discarded instantly; only the millisecond timestamps are transmitted.

---

## 🛠️ The Architecture

The image below outlines the full workflow from the edge device (Smartphone Keyboard) to the Cloud ML Engine, and finally to the Caregiver Dashboard.

<img src="/public/architecture.jpg" alt="Cognitive Monitoring Workflow Architecture Diagram" width="100%" />

---

## 🚀 The Hackathon MVP (What We Built)

Building a native OS-level keyboard background service is impossible within a 24-hour hackathon. Therefore, our MVP is a **Live Web-Based Split-Screen Simulator** designed to prove the core mathematical concept and visual dashboard.

**The Tech Stack:**
*   **Frontend:** Next.js 16 (App Router), React 19
*   **Styling:** Tailwind CSS v4, Custom Neo-Brutalist CSS utilities
*   **Data Visualization:** Recharts (Real-time step-after line charts)
*   **Animation:** Framer Motion, Radix UI

### Key Features of the MVP:
*   **Live Mathematical Engine:** We wrote pure JS event listeners (`onKeyDown`, `onKeyUp`) that use `Date.now()` to calculate your actual Flight and Dwell times in real-time right in the browser.
*   **Split-Screen UI:** Demonstrates the "Patient" side (a normal chat app) alongside the "Caregiver" side (the live telemetry dashboard).
*   **Dynamic Cognitive Fluidity Score:** A rolling average algorithm that penalizes erratic typing, slow flight times, and heavy backspace usage, dynamically shifting the UI from Green (Optimal) to Red (Anomaly Detected).

---

## 👨‍💻 How to Test the Live MVP

To experience the "Smoke and Mirrors" live demo, follow these exact steps:

1.  **Start the Simulator:** Launch the app and click **"Run the Live Demo"** from the landing page.
2.  **Phase 1: The Healthy Baseline**
    *   Click into the chat box on the left pane and type a normal, casual sentence at your normal speed (e.g., *"Hi Rahul, I am doing great today."*).
    *   **Observe:** The right pane dashboard will stay Lime Green. The Cognitive Fluidity Score will remain above 90. The Recharts line graphs will remain flat and below the baseline.
3.  **Phase 2: Simulating Cognitive Decline**
    *   Now, simulate a patient experiencing cognitive hesitation or motor tremors.
    *   **Action 1 (High Dwell):** Press and intentionally *hold* a key down for a split second longer than normal before releasing it.
    *   **Action 2 (High Flight):** Type a word, stop and pause entirely for a full second, then type the next word.
    *   **Action 3 (Corrections):** Hit the Backspace key 5 or 6 times rapidly.
4.  **The Result:** 
    *   The mathematical engine will immediately catch the variance. 
    *   The `Cognitive Fluidity Score` will crash below 70.
    *   The dashboard will violently flash **Hot Coral Red**.
    *   The "ANOMALY DETECTED" banner will trigger, proving the concept works on live data.

---

## 🔮 Future Scope (The Real Product)

While this MVP is a web simulator, the actual production build will consist of:

1.  **The Edge Device Layer:** Native Custom Keyboard Extensions for iOS (Swift) and Android (Kotlin) that silently collect timestamps.
2.  **The Cloud Backend:** AWS Kinesis for data ingestion and TimescaleDB for storing millions of millisecond-precise time-series data points.
3.  **The ML Engine:** Python/PyTorch-based anomaly detection models (e.g., Isolation Forests) that establish a personalized 14-day baseline for the user and flag deviations mathematically, rather than relying on hardcoded thresholds.
4.  **Caregiver Alerts:** Automated SMS/Email push notifications when the ML engine detects a sustained 7-day downward trend in cognitive fluidity.

---

