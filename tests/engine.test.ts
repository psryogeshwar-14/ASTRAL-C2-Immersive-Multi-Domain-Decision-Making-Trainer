import { SeededPRNG } from '../server/engine/prng.ts';
import { GroundTruthEngine } from '../server/engine/groundTruth.ts';
import { DegradationLayer } from '../server/engine/degradationLayer.ts';
import { AARGenerator } from '../server/aar/aarGenerator.ts';
import { 
  SCENARIOS, 
  getInitialUnits, 
  getInitialCommsMetrics, 
  getScriptedRadioChatter 
} from '../src/services/scenarioEngine.ts';
import type { TraineeDecision } from '../src/types/tactical.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('--- RUNNING ASTRAL-C2 DETERMINISM & DEGRADATION TEST SUITE ---\n');

// 1. Test Seeded PRNG Determinism
const prng1 = new SeededPRNG(4242);
const prng2 = new SeededPRNG(4242);
const samples1 = [prng1.next(), prng1.next(), prng1.nextRange(10, 50), prng1.nextInt(1, 100)];
const samples2 = [prng2.next(), prng2.next(), prng2.nextRange(10, 50), prng2.nextInt(1, 100)];

assert(
  JSON.stringify(samples1) === JSON.stringify(samples2),
  'Mulberry32 PRNG produces identical sequences with identical seeds'
);

// 2. Test Ground Truth Engine Initialization & Ticking
const engine1 = new GroundTruthEngine(
  'TEST-SESSION-1',
  SCENARIOS[0],
  999,
  getInitialUnits(),
  getInitialCommsMetrics(),
  getScriptedRadioChatter()
);

const initialTime = engine1.getExerciseTime();
engine1.tick();
engine1.tick();
engine1.tick();
assert(engine1.getExerciseTime() === initialTime + 3, 'GroundTruthEngine increments time by 1s per tick');

// 3. Test Degradation Layer: Role Projections
const degradation = new DegradationLayer(999);
const comms = getInitialCommsMetrics();
comms.latencyMs = 15000;
comms.packetLoss = 45;

const groundTruthUnits = getInitialUnits();
const whiteCellUnits = degradation.projectUnitsForRole(groundTruthUnits, 'INSTRUCTOR_WHITE_CELL', comms, 10);
const traineeUnits = degradation.projectUnitsForRole(groundTruthUnits, 'SUB_UNIT_CDR', comms, 10);

assert(
  whiteCellUnits[0].groundTruthPos.x === groundTruthUnits[0].groundTruthPos.x,
  'Instructor receives uncorrupted ground truth coordinates'
);

assert(
  traineeUnits[0].uncertaintyRadius >= 400,
  'Trainee perceived uncertainty radius expands under 45% packet loss and 15s latency'
);

// 4. Test Radio Garbling
const testMsg = 'ENEMY ARMOR DETECTED ADVANCING THROUGH GORGE DEF';
const degradedRadio = degradation.degradeRadioText(testMsg, comms);
assert(
  degradedRadio.audioNoiseRatio > 0.3,
  'Audio noise ratio increases under low SNR and high packet loss'
);

// 5. Test Trainee Decision Evaluation & Fratricide Detection
const fireOrder = engine1.executeDecision({
  commanderCallsign: 'MAJOR-AJAY',
  actionType: 'ARTILLERY_FIRE_MISSION',
  targetUnitId: 'BLU-CHARLIE', // Friendly unit!
  targetCallsign: 'CHARLIE-6',
  uncertaintyAtTime: 900,
  rationale: 'Suspected radar movement in defile',
  confidenceLevel: 5,
});

assert(
  fireOrder.decision.evaluatedEffect === 'FRIENDLY_FIRE_RISK',
  'Artillery targeting friendly unit correctly flagged as FRIENDLY_FIRE_RISK'
);
assert(
  fireOrder.decision.scoreDelta < 0,
  'Friendly fire attempt incurs heavy tactical score penalty'
);

// 6. Test AAR Confidence Calibration Scoring
const mockDecisions: TraineeDecision[] = [
  fireOrder.decision,
  {
    id: 'DEC-2',
    timestamp: '12:05:00',
    exerciseElapsedSec: 65,
    commanderCallsign: 'MAJOR-AJAY',
    actionType: 'CHALLENGE_IFF_KEY',
    targetUnitId: 'OPFOR-LOITERING-SWARM',
    uncertaintyAtTime: 200,
    rationale: 'Verify radar transponder key before committing air defense',
    confidenceLevel: 3,
    evaluatedEffect: 'EFFECTIVE_COUNTERMEASURE',
    scoreDelta: 18,
    feedback: 'Disciplined countermeasure',
    groundTruthDeviationMeters: 40,
  }
];

const calibration = AARGenerator.computeCalibration(mockDecisions);
assert(calibration.totalDecisions === 2, 'Calibration accurately counted total decisions');
assert(calibration.overconfidentDecisions >= 1, 'Overconfident decision (Confidence 5 with fratricide risk) correctly categorized');
assert(typeof calibration.brierScore === 'number' && calibration.brierScore > 0, 'Brier score computed mathematically');

// 7. Test Local Deterministic Military Narrative Generator
const narrative = AARGenerator.generateLocalTacticalNarrative(SCENARIOS[0], mockDecisions, calibration);
assert(
  narrative.includes('EXECUTIVE SUMMARY & TACTICAL APPRAISAL') &&
  narrative.includes('GROUND TRUTH VS. PERCEIVED SITUATION ANALYSIS') &&
  narrative.includes('CONFIDENCE CALIBRATION & DECISION AUDIT'),
  'AAR narrative contains all required DSSC evaluation sections'
);

// 8. Test Denial vs Deception: Spoofed Orders & Shackle Code Challenge
const deceptionInject = engine1.injectSpoofedOrder();
assert(
  deceptionInject !== null && deceptionInject.isDeception === true,
  'Deception engine generates spoofed order masquerading as Brigade HQ directive'
);
assert(
  deceptionInject.isValidAuth === false,
  'Deception order includes invalid authentication challenge'
);

// Challenge Shackle authentication / reject deception
const challengeResult = engine1.respondToSpoofedOrder(deceptionInject.id, 'REJECT_AS_DECEPTION');
assert(
  challengeResult.scoreDelta === 30,
  'Successful Shackle challenge / rejection awards +30 tactical points for resisting deception'
);

// 9. Test Verification Actions (US Navy Degraded Comms Study Metric)
const runnerAction = engine1.startVerification('PHYSICAL_RUNNER', 'OPFOR-ARMOR-COLUMN', 'Runner Ground Line', 45);
assert(
  runnerAction.durationSec === 45,
  'Physical Runner requires realistic 45-second terrain foot transit delay'
);
assert(
  runnerAction.type === 'PHYSICAL_RUNNER',
  'Physical Runner registered as stealth compensation action'
);

// Tick runner to completion (45 seconds)
for (let i = 0; i < 45; i++) {
  engine1.tick();
}
const perceivedUnits = engine1.getUnitsForRole('SUB_UNIT_CDR');
const verifiedUnit = perceivedUnits.find(u => u.id === 'OPFOR-ARMOR-COLUMN');
assert(
  verifiedUnit !== undefined && verifiedUnit.uncertaintyRadius <= 50,
  'Completed runner verification collapsed target position uncertainty to <= 50m'
);

// 10. Test EMCON Physics: RF Accumulation, Hostile DF Lock & Natural Decay
const initialRF = engine1.getEMCONState().rfSignaturePct;
engine1.executeDecision({
  commanderCallsign: 'MAJOR-AJAY',
  actionType: 'ARTILLERY_FIRE_MISSION',
  targetUnitId: 'OPFOR-ARMOR-COLUMN',
  targetCallsign: 'ARMOR-COLUMN',
  uncertaintyAtTime: 40,
  rationale: 'Target verified by runner',
  confidenceLevel: 5,
});

const postFireRF = engine1.getEMCONState().rfSignaturePct;
assert(
  postFireRF > initialRF,
  'Artillery fire mission transmits fire direction telemetry and elevates RF signature'
);

// 10. Test EMCON Physics: Silence Cooldown & Hostile DF Re-Triangulation
assert(
  engine1.getEMCONState().adversaryDFLockPct === 100,
  'Adversary Direction-Finding antennas achieved full 100% triangulation after prolonged operations'
);

// Under transmission silence, RF signature and DF lock naturally cool down
const rfBeforeCooldown = engine1.getEMCONState().rfSignaturePct;
for (let i = 0; i < 60; i++) {
  engine1.tick();
}
assert(
  engine1.getEMCONState().rfSignaturePct < rfBeforeCooldown,
  'Radio silence steadily cools RF thermal and spectral footprint'
);
assert(
  engine1.getEMCONState().adversaryDFLockPct < 100,
  'Prolonged radio silence degrades hostile direction-finding lock below 100%'
);

// Now burst transmissions to prove DF lock re-accumulation
const dfCool = engine1.getEMCONState().adversaryDFLockPct;
for (let i = 0; i < 3; i++) {
  engine1.transmitRadioMessage({
    senderCallsign: 'SUB-UNIT-CDR',
    domain: 'LAND',
    text: `BURST: Transmission ${i}`,
    priority: 'ROUTINE',
  });
}
engine1.tick();
assert(
  engine1.getEMCONState().adversaryDFLockPct > dfCool,
  'Adversary Direction-Finding antennas rapidly re-triangulate emitter on new RF bursts'
);

// 11. Test Counterfactual Replay Fork Engine (Branching "What If?")
const targetDecision = mockDecisions[0]; // The fratricidal fire mission
const counterfactualResult = engine1.generateCounterfactual(
  targetDecision.id,
  'CHALLENGE_IFF_KEY',
  'Verify radar beacon before engaging'
);

assert(
  counterfactualResult.doctrineVerdict === 'OPTIMAL_DOCTRINE',
  'Counterfactual engine evaluates alternative COA as OPTIMAL_DOCTRINE'
);
assert(
  counterfactualResult.ammoSaved === 48,
  'Counterfactual replay proves holding fire saved 48 rounds of 155mm HE artillery'
);
assert(
  counterfactualResult.rfExposureAvoidedPct === 35,
  'Counterfactual replay confirms 35% RF exposure avoided'
);
assert(
  counterfactualResult.projectedScoreDelta > 0,
  'Counterfactual alternative COA delivers positive projected tactical score delta'
);

console.log('\n🌟 ALL 11 TACTICAL ENGINE & AAR TESTS (INCLUDING TOP 4 MUST FEATURES) PASSED 100% DETERMINISTICALLY!\n');

