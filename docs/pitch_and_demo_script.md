# Astral-C2: 3-Minute Pitch & Evaluator Demonstration Script

**Target Audience:** Ministry of Defence (MoD) / Defence Services Staff College (DSSC) Wellington Evaluators  
**Problem Statement:** *Immersive Multi-Domain Decision-Making Trainer for Degraded Communication Environments*  
**System Name:** **Astral-C2 (Advanced Synthetic Tactical Resilience & After-Action Logger)**  
**Platform:** Web-First, Multiplayer, Air-Gapped LAN Ready (TypeScript / Node / Three.js)

---

## Part 1: The 3-Minute Executive Pitch

*(Spoken with crisp military tempo. Total speaking time: 2 mins 45 secs)*

> **[0:00 - 0:35] THE HOOK: The Fatal Assumption of Contemporary Exercises**  
> *"Good morning, respected Directing Staff and Evaluators.*  
> *In conventional Command Post Exercises and Sandtable TEWTs, we teach tactical doctrine under a fatal, peacetime assumption: **that communications work**.*  
> *We assume that when a sub-unit commander radios battalion, the frequency is clear. We assume that Blue Force Tracker coordinates are pristine, and that secondary radar tracks are authentic.*  
> *Contemporary high-altitude conflicts in Ladakh and Eastern Europe prove the opposite: **the exact second a commander must make a kinetic decision is the exact second Krasukha-4 jammers elevate the RF noise floor, satellite repeaters go dark, and cyber disruption injects false telemetry.**  
> *When officers train only with perfect information, their first experience of degraded comms in combat leads to catastrophic hesitation—or fatal fratricide."*

> **[0:35 - 1:20] THE SOLUTION: Astral-C2**  
> *"To solve this critical training deficit, we built **Astral-C2**—an immersive multi-domain decision-making simulator engineered specifically for degraded communication environments.*  
> *Unlike conventional simulators that test whether a trainee 'won the engagement', Astral-C2 measures **how well commanders make decisions under uncertainty, cognitive friction, and electronic deception.**  
> *It runs on any standard web browser across a secure local area network (LAN) inside an air-gapped bunker—with zero external hardware or cloud dependencies."*

> **[1:20 - 2:05] THREE CORE INNOVATIONS**  
> *"Astral-C2 delivers three breakthroughs directly addressing the MoD challenge:*  
>  
> *1. **Asymmetric Role-Degraded Perception:** A Sub-unit Commander on VHF radio, a JTAC on secondary datalink, and an EW Officer on the spectrum analyzer each receive a different, degraded slice of the same battlefield. Positions wander, telemetry lags by 15 seconds, and radio transcripts garble dynamically based on real-time Signal-to-Noise Ratio (SNR).*  
>  
> *2. **NATO Admiralty Intelligence Reliability (A1–F6):** Trainees do not see generic icons. Every contact carries an intelligence reliability rating that decays over time. If a report is 4 minutes old from a compromised runner, its credibility drops from A1 to D4.*  
>  
> *3. **Confidence Calibration Scoring & The Ground Truth Replay:** When a commander logs an order, they must record their tactical rationale and confidence rating (1 to 5). In the After-Action Review (AAR), our mathematical calibration engine evaluates whether the officer was **Prudently Calibrated** or **Dangerously Overconfident**—showing them side-by-side where their perceived target was versus where the enemy actually stood."*

> **[2:05 - 2:45] THE CONCLUSION & STRATEGIC VALUE**  
> *"Astral-C2 transforms training from mechanical gunnery drills into a crucible of cognitive discipline.*  
> *It equips junior and mid-level commanders with the instinct to question corrupted data, institute emissions control, and verify before pulling the trigger.*  
> *We have two terminals live on our local LAN node right now. Allow us to demonstrate how an exercise unfolds."*

---

## Part 2: Step-by-Step Evaluator Demonstration Script

### Setup Before Evaluators Arrive
- **Terminal A (Laptop 1 / Left Screen):** Trainee Console (`SUB_UNIT_CDR` — Major Ajay).
- **Terminal B (Laptop 2 / Right Screen):** Instructor Console (`INSTRUCTOR_WHITE_CELL` — Directing Staff).
- Both terminals connected to the same LAN server (`ws://localhost:3001` or LAN IP).
- Header displays: `🟢 LAN WS: ROOM_ALPHA (2 NODES)`.

---

### Step 1: The Initial Baseline (T+00:00)
- **What to do:** Show the Trainee terminal.
- **Narrate to Judge:**  
  *"Here is the Sub-unit Commander's Common Operating Picture during Operation Trishul Ridge in Eastern Ladakh. Notice the top telemetry bar: VHF Net 1 is active, SNR is 12 dB, and latency is a manageable 7 seconds. The forward reconnaissance patrol and Charlie Company are reporting regularly."*
- **Visual Cue:** Point to the 3D topographic sandtable and the green Admiralty tags (`A1`, `B2`).

---

### Step 2: The Directing Staff Strikes (T+00:30)
- **What to do:** On Terminal B (Instructor), click **`EW BARRAGE PRESET`** (or slide EW Jammer Power to 85 kW).
- **Narrate to Judge:**  
  *"Now, watch Terminal B as Directing Staff injects hostile Krasukha-4 barrage jamming. Immediately, the RF noise floor surges. Look at what happens to the Trainee's console."*
- **Visual Cue on Trainee Console:**
  - Comms diagnostics drop to `RED / SEVERE NOISE FLOOR`.
  - Radio log begins printing garbled text: `"SAMYUKTA-EW: H#gh-power RF noise... fl..ding VHF band..."` accompanied by procedural static audio.
  - The uncertainty circles (CEP ellipses) around Charlie Company expand from 350m to 1400m.

---

### Step 3: Injecting the Deception — The Cyber Ghost (T+01:00)
- **What to do:** On Terminal B (Instructor), click **`GPS SPOOF / GHOST DRONE`**.
- **Narrate to Judge:**  
  *"The adversary now exploits corrupted datalink relays to inject a phantom air strike bogey—Bogey-9. Look at Terminal A: the Trainee sees a fast-moving strike aircraft painted at 7,200 meters. But check the Admiralty rating: it is graded **E5 (Unverified Secondary Radar)**."*
- **Visual Cue:** Show the phantom contact with a warning beacon and contradictory advisory.

---

### Step 4: The Trainee's Critical Decision (T+01:30)
- **What to do:** On Terminal A (Trainee), select `OPFOR-ARMOR-COLUMN` or `BOGEY-9`. Click **`EXECUTE TACTICAL ORDER`**:
  - Action: `ARTILLERY_FIRE_MISSION`
  - Target: `OPFOR-ARMOR-COLUMN` (which is lagging by 15 seconds)
  - Rationale: *"Suppress hostile armored probe advancing down defile"*
  - Confidence Rating: **5 Stars (Extreme Confidence)**
  - Click **`AUTHORIZE KINETIC ENGAGEMENT`**.
- **Visual Cue:** 3D ballistic parabolic tracer arcs across the Himalayan mountain peaks, detonating at the perceived coordinates.
- **Narrate to Judge:**  
  *"The commander committed battery fire with 5-star confidence. But was the target actually at those coordinates? Let's open the DSSC debrief."*

---

### Step 5: The "WOW" Moment — Side-by-Side AAR Scrubber & Calibration (T+02:15)
- **What to do:** Click **`AAR DEBRIEF`** in the top navigation bar.
- **Narrate to Judge:**  
  *"This is the core differentiator of Astral-C2: the **Ground Truth vs. What You Saw** replay scrubber."*
- **Action on Screen:**
  - Drag the interactive timeline scrubber back to the exact second of the artillery order.
  - Show the **Cyan solid unit (Perceived Target)** versus the **Red dashed ghost (Actual Ground Truth)**.
  - Point to the **Ground Truth Offset: 680 meters**.
  - Switch to the **`CONFIDENCE CALIBRATION`** tab:
    - Verdict: **`DANGEROUSLY_OVERCONFIDENT`**.
    - Explain: *"The commander possessed 5-star confidence while acting on 18-second-old telemetry. In mountain warfare, a mechanized column moves 140 meters in 18 seconds. The battery fired into empty scree."*
  - Switch to the **`DSSC DISPATCH`** tab and click **`PRINT / EXPORT REPORT`** to show the ready-to-archive military debrief document.

---

## Part 3: Anticipated Judge Questions & Bulletproof Answers

### Q1: *"Why did you build a web application instead of VR headsets?"*
> **Answer:**  
> *"Operational readiness and scalability. In a real tactical command post or DSSC seminar room, you cannot equip 40 staff officers simultaneously with fragile VR goggles. The problem statement explicitly specifies 'AR/VR **or** web-based'. By building on high-performance WebGL (Three.js) and WebSockets, any laptop, ruggedized field terminal, or classroom projector can join an exercise instantly. The training value is in the cognitive friction and after-action replay, not headset hardware."*

### Q2: *"Can this connect to real military communications hardware or protocols like Link-16?"*
> **Answer:**  
> *"Yes. The architecture separates the `GroundTruthEngine` from the `DegradationLayer` via standard TypeScript interfaces. For production deployment, the degradation layer can ingest raw UDP DIS/HLA packets, NMEA GPS strings, or tactical CNR audio feeds, degrade them according to measured terrain RF propagation models, and republish them to actual Blue Force Tracker consoles."*

### Q3: *"Is this secure for classified, air-gapped military networks?"*
> **Answer:**  
> *"Completely air-gapped. Astral-C2 requires zero internet connection. All physics, 3D terrain synthesis, procedural radio audio, and tactical AAR evaluation run locally on Node and in-memory WebSockets. Our Docker Compose container boots up on a closed LAN in under 10 seconds."*
