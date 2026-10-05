# ASTRAL-C2: Immersive Multi-Domain Decision-Making Trainer
## Ministry of Defence (MoD) • Defence Services Staff College (DSSC)

[![Live Demo](https://img.shields.io/badge/LIVE%20DEMO-ASTRAL--C2%20CONSOLE-00e5ff?style=for-the-badge&logo=vercel)](https://astral-c2-immersive-multi-domain-de.vercel.app/)
[![Status](https://img.shields.io/badge/DEPLOYMENT-OPERATIONAL-00ff66?style=for-the-badge)](https://astral-c2-immersive-multi-domain-de.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> 🌐 **Live Web Application (Vercel):** [https://astral-c2-immersive-multi-domain-de.vercel.app/](https://astral-c2-immersive-multi-domain-de.vercel.app/)

### Problem Statement Title
**Immersive Multi-Domain Decision-Making Trainer for Degraded Communication Environments**

### Architecture & Design Philosophy
Following the strategic recommendations for the Smart India Hackathon (SIH) Defence Services Staff College problem statement, **ASTRAL-C2** is architected **web-first** with **Design 4: Cyber Tech / Military Ops Console**. 

This eliminates the hardware dependencies, calibration issues, and live demo risks of AR/VR headsets while focusing effort on the core hackathon value drivers: the **Dynamic Degradation Physics Engine**, the **Confidence Calibration Engine**, and the **Interactive "Ground Truth vs. What You Saw" Side-by-Side AAR Replay**.

---

### The Core Pitch
> *"Training wargames let commanders fight with good information. We train them to fight when the information is jammed, delayed, or lying to them, and we show them exactly what they believed versus what was true."*

---

### Research-Grounded Innovation: Bridging the Real-World Training Gap

Our solution incorporates critical findings from recent real-world conflicts, military training literature, and Indian Army doctrine:

1. **Denial vs. Deception (Lessons from Ukraine & US NTC Fort Irwin):**
   - Traditional exercises focus almost exclusively on *denial* (jamming, packet drops, radio silence). In contemporary high-intensity conflict, **deception** is far more lethal.
   - Opposing forces now deploy generative voice synthesis and captured frequencies to flood combat nets with fraudulent command directives.
   - **ASTRAL-C2** injects hostile deepfake radio orders (e.g., fraudulent Brigade HQ directives commanding retreat from defensive ridgelines) that require challenge-reply authentication to defeat.

2. **Sensor Compensation Behavior (US Navy Degraded Comms Research):**
   - Navy research on degraded tactical communications revealed that under jamming, commanders consistently experience delayed decision cycles and rarely attempt to compensate with alternate, uncorrupted data sources.
   - **ASTRAL-C2** introduces the **Verification & Compensation Action Dock**, forcing commanders to balance the **time-cost** of verification (Physical Runner, Optical UAV Gimbal, Shackle Challenge) against the hazard of hasty kinetic fire.

3. **Emission-Control (EMCON) Physics & Hostile Direction-Finding (DF):**
   - In modern electronic warfare, every radio transmission and fire-direction burst acts as a beacon for hostile SIGINT.
   - **ASTRAL-C2** implements live **RF Signature physics**: transmitting on combat radio or firing artillery increases command post emissions; exceeding 70% allows enemy counter-battery radar to achieve triangulation lock (`CRITICAL_LOCK_IMMINENT`). Radio silence (EMCON Alpha) naturally cools RF thermal and spectral footprints.

4. **Counterfactual Replay Fork in AAR (Branching "What If?"):**
   - Directing staff can select any recorded tactical decision and branch into an alternative timeline (e.g., verifying with an optical drone rather than expending 48 artillery rounds on an empty cyber phantom).
   - Generates side-by-side comparative scorecards detailing ammunition conserved, fratricide averted, and RF exposure mitigated.

5. **Indigenously Aligned with Indian Army WARDEC Doctrine:**
   - Designed in alignment with the Indian Army Wargaming Development Centre (WARDEC) mandate for indigenous, AI/ML-assisted, air-gappable simulation tools under *Atmanirbharta*.
   - **Zero-Hallucination Adjudication:** Adjudication is computed **100% deterministically** using the Mulberry32 seeded PRNG engine. Generative AI is strictly confined to narrative debrief drafting under Directing Staff oversight, directly solving the US Army War College's findings on LLM hallucination in wargames.

---

### Core Capabilities & The Top 4 "Must-Have" Features

#### 1. Denial vs. Deception: Spoofed Orders & Shackle Authentication
- **Hostile Directive Injections:** OPFOR electronically impersonates higher headquarters, broadcasting emergency withdrawal directives.
- **Trainee Response Options:**
  - `CHALLENGE SHACKLE (15s)`: Verifies authenticity against the hourly rolling cipher matrix. Unmasks fraudulent orders and awards $+30$ points.
  - `REJECT DECEPTION`: Commander recognizes operational anomalies and holds position ($+25$ points).
  - `OBEY DIRECTIVE`: Blind compliance induces catastrophic abandonment of defensive key terrain ($-40$ penalty).

#### 2. Verification & Sensor Compensation Dock (Time-Cost Actions)
- When contacts appear ambiguous or contradictory, commanders can initiate jam-proof corroboration:
  - **Physical Jam-Proof Runner (45s • 0% RF):** Dispatches motorcycle/foot courier through mountain defiles. Completely immune to RF jamming; collapses uncertainty to $\pm 50\text{m}$.
  - **Optical UAV Gimbal (20s):** Dispatches high-altitude electro-optical sensor to confirm whether radar contacts are genuine combat vehicles or cyber phantom decoys.
  - **Cryptographic Shackle / IFF Challenge (15s):** Interrogates transponder codes to prevent friendly-fire fratricide.

#### 3. EMCON Emission-Control & Hostile DF Threat Gauge
- Dual real-time gauges monitor:
  - **Command Post RF Signature ($0\text{--}100\%$):** Increases on radio transmissions ($+12\%$) and artillery fire direction ($+25\%$).
  - **Adversary SIGINT DF Triangulation Lock ($0\text{--}100\%$):** Accumulates when RF exceeds $60\%$.
  - **Counter-Battery Threat Level:** Escalates from `LOW` to `ELEVATED` to `CRITICAL_LOCK_IMMINENT`, triggering incoming BM-30 Smerch rocket salvo warnings.

#### 4. Counterfactual Replay Fork in AAR ("What If?" Decision Rewind)
- Embedded in the After Action Review (AAR):
  - **Branch A (Historical Recorded Execution):** Documents original decision, ammo expended on decoys, and high RF footprint.
  - **Branch B (Counterfactual Projection):** Demonstrates what would have occurred had the commander delayed fire to cross-check or ordered EMCON silence.
  - **Quantitative Divergence Scorecard:** Highlights saved rounds, stealth retention, and DSSC Directing Staff doctrine lessons learned.

#### 5. "Ground Truth vs. What You Saw" Side-by-Side Replay Scrubber
- Replays the entire engagement second-by-second.
- **Left Viewport (Green):** Canonical Ground Truth reality.
- **Right Viewport (Amber):** Degraded tactical COP as perceived by the trainee.
- Mathematical Brier Score evaluating commander confidence calibration (overconfident vs. calibrated vs. underconfident).

#### 6. Screen-Friendly Display Architecture & Hotkeys
- **Adaptive Layout Modes:**
  - `Standard (1)`: 70/30 primary operational layout with 3D Sandtable & C2 Console.
  - `Split (2)`: 50/50 dual balanced command post layout.
  - `Theater (3 / T)`: 100% full-screen 3D Sandtable for stage briefings and auditorium projectors, with floating `[ RESTORE C2 CONSOLE (T) ]` HUD badge.
- **Display Density (D):** `COMPACT` mode eliminates vertical clipping on laptops and displays $\le 900\text{px}$ height (1920×899 / 1366×768); `STANDARD` mode for 2K/4K monitors.
- **Native Fullscreen (F):** One-key borderless presentation mode.
- **Mobile/Tablet Responsive (< 1024px):** Instant touch tab switcher between `[ 🗺️ 3D SANDTABLE ]` and `[ 📡 C2 CONSOLE ]`.

### Technical Stack & Architecture
- **Frontend Console:** React 19 + TypeScript + Vite + Three.js (Holographic Himalayan sandtable, Krasukha-4 jamming domes, uncertainty ellipses, ballistic arcs)
- **Multiplayer Backend Server:** Node.js + Express + WebSocket (`ws`) + TypeScript (`tsx`)
- **Physics & Degradation Engine:** Canonical Ground Truth with Mulberry32 seeded deterministic PRNG for 100% reproducible bit-for-bit AAR replays
- **Intelligence System:** NATO Admiralty Rating (A1–F6) with automated time-decay and cognitive confidence calibration
- **After Action Review (AAR):** Timeline scrubber, mathematical Brier calibration score, print-ready military dispatch, and optional Gemini LLM integration with offline fallback
- **Air-Gapped Deployment:** Docker Compose for 1-command LAN demonstration

---

### Project Structure

```
fogops/ (sih3)
├── frontend/ (src/)
│   ├── components/      # Sandtable3D, TacticalCOP, InstructorDashboard, RoleSwitcher, AARModal
│   ├── services/        # networkClient (WebSocket), audioEngine (Web Audio CNR synth), scenarioEngine
│   └── types/           # tactical data models (units, comms, decisions, Admiralty A1-F6)
├── server/              # Node + Express + WebSocket backend
│   ├── engine/          # groundTruth.ts, degradationLayer.ts, eventLog.ts, prng.ts
│   ├── scenarios/       # trishulRidge.json (multi-domain mission & timed injects)
│   ├── aar/             # aarGenerator.ts (calibration scoring, LLM debrief narrative)
│   └── index.ts         # WebSocket rooms & REST endpoints
├── tests/               # engine.test.ts (determinism, kinematics, degradation, scoring)
├── deployment/          # Dockerfile, docker-compose.yml (air-gapped LAN deployment)
├── docs/                # pitch_and_demo_script.md (3-min pitch & judge demo script)
├── .env.example
└── README.md
```

---

### Quickstart: Try Live or Run Locally

#### Option A: Direct Live Web Access (Zero Install)
Launch the operational, high-performance wargaming simulator directly in your web browser:  
👉 **[https://astral-c2-immersive-multi-domain-de.vercel.app/](https://astral-c2-immersive-multi-domain-de.vercel.app/)**

#### Option B: Running with npm (Local Dev & LAN Multiplayer)
```bash
# Terminal 1: Launch Backend Server (WebSocket + REST API on port 3001)
npm run server

# Terminal 2: Launch Frontend Console (Vite on port 5173)
npm run dev

# Run Automated Engine Determinism & Degradation Test Suite
npm run test:engine
```

- Open `http://localhost:5173/` in Browser 1 (select **Sub-Unit Commander**).
- Open `http://localhost:5173/` in Browser 2 or on a second machine on the same LAN (select **White Cell Controller**).
- Both terminals automatically sync via WebSocket room `ROOM_ALPHA`.

#### Option B: 1-Command Air-Gapped Docker Deployment
```bash
cd deployment
docker compose up --build
```

---

### Demonstrating to Evaluators (3-Minute Script)
Refer to [`docs/pitch_and_demo_script.md`](file:///Users/psryogeshwar/Documents/Documents/Project/SIH3/docs/pitch_and_demo_script.md) for the complete spoken-word pitch, 5-step live demonstration sequence, and bulletproof answers to technical questions.
