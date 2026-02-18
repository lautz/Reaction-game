# Reaction Lab | Reflex Engine

Reaction Lab is a high-precision browser-based application designed to test and train neural latency (reaction time). It combines 3D visuals, procedural audio, and a sophisticated scoring algorithm to provide a gamified cognitive assessment.

## 🎮 How to Play

*   **Initialize Session:** Set your desired **Start** and **Target** intensity levels on the setup screen.
*   **The Goal:** Click the screen the instant the 3D sphere turns **GREEN**.
*   **Rules:**
    *   Wait for the signal. Clicking too early results in a "False Start".
    *   **Ignore Decoys:** Do not click on **PURPLE** or **ORANGE** signals.
    *   **Focus:** You have exactly 20 rounds to prove your efficiency.
*   **Progression:** The difficulty scales linearly from your Start Intensity to your Target Intensity over the course of the 20 rounds.

## ⚙️ Difficulty System (Intensity)

The "Intensity" level (1-10) dynamically alters the physics and probability of the simulation:

*   **Target Size (Fitts's Law):** At higher intensities, the target becomes significantly smaller, requiring more precise motor control.
*   **Decoy Probability:**
    *   **Levels 1-3:** No decoys. Pure reaction.
    *   **Levels 4-6:** Moderate chance of Purple decoys.
    *   **Levels 7-10:** High chance of Purple and Orange (Level 2) decoys.

## 🧠 The Scoring Algorithm

Reaction Lab uses a "handicapped" scoring model to reward playing at higher difficulties. It acknowledges that hitting smaller targets amidst distractions takes physically longer than hitting large, static targets.

### 1. Intensity Handicap
The engine calculates an **Adjusted Reaction Time** by subtracting a bonus from your raw average speed.

> **Formula:** `Handicap = (Average Session Intensity - 1) × 8ms`

*Example: If you play at Intensity 10, you receive a 72ms deduction from your raw time, allowing you to score higher even if your raw reaction is slower due to the difficulty.*

### 2. Performance Audit (Ranks)
Your **Final Score (0-10)** is calculated based on your Adjusted Reaction Time, minus any penalties for False Starts.

| Score | Threshold (Adjusted) | Rank Title | Verdict |
| :---: | :--- | :--- | :--- |
| **10** | < 220ms | **HUMAN AIMBOT** | Break the simulation. You’ve officially peaked. |
| **9** | < 250ms | **CYBERNETIC** | Exceptional output. Your hardware is elite. |
| **8** | < 280ms | **ELITE OPERATIVE** | High-tier performance. Very few can keep up. |
| **7** | < 310ms | **SYSTEM SPECIALIST** | Solid results. You’re clearly in the zone. |
| **6** | < 350ms | **STABLE BUILD** | Reliable and consistent. A very safe bet. |
| **5** | < 400ms | **STANDARD ISSUE** | Within parameters. Good, but there’s more in you. |
| **4** | < 480ms | **WORK IN PROGRESS** | Acceptable for now. Let’s aim for more "spark." |
| **3** | < 550ms | **POWER SAVER MODE** | You’re taking it easy. Time to wake the system up. |
| **2** | > 550ms | **SYSTEM LAG** | Low energy detected. A reboot is highly advised. |

## 🛠 Technical Stack

*   **Core:** Vanilla JavaScript (ES6+)
*   **Visuals:** Three.js (WebGL) for the 3D environment and dynamic lighting.
*   **Audio:** Native Web Audio API. All sounds (success blips, error buzzers, ambient drones) are generated procedurally in real-time. No external audio files are used.
*   **Storage:** `localStorage` is used to persist your Personal Best time and Highest Session Rating.

## 🚀 Installation & Usage

1.  Download the `index.html` file.
2.  Open it in any modern web browser (Chrome, Firefox, Edge, Safari).
3.  No server or installation required.
