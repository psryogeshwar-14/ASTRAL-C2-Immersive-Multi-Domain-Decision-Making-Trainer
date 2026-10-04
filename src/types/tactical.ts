export type TacticalDomain = 'LAND' | 'AIR' | 'CYBER' | 'EW';
export type Affiliation = 'BLUFOR' | 'OPFOR' | 'NEUTRAL' | 'UNKNOWN';
export type UnitStatus = 'OPTIMAL' | 'ENGAGED' | 'DEGRADED' | 'SILENT' | 'DESTROYED';
export type DisruptionType = 'EW_JAMMING' | 'GPS_SPOOF' | 'PACKET_LOSS' | 'LATENCY_LAG' | 'CONTRADICTORY_REPORT' | 'RADIO_DROPOUT';

export interface TacticalPosition {
  x: number; // Coordinates on terrain grid (-100 to +100)
  y: number; // Elevation / altitude
  z: number; // Coordinates on terrain grid (-100 to +100)
  gridRef: string; // MGRS e.g. "43X MH 8421 9134"
}

export interface AdmiraltyCode {
  reliability: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; // Source Reliability
  credibility: 1 | 2 | 3 | 4 | 5 | 6; // Information Credibility
  source: string; // e.g. "Forward Observation Post (Optical)", "EO/IR UAV Gimbal", "Secondary Radar"
  ageSec: number; // Time since data collection in seconds
}

export interface TacticalUnit {
  id: string;
  callsign: string;
  name: string;
  domain: TacticalDomain;
  affiliation: Affiliation;
  type: string;
  groundTruthPos: TacticalPosition;
  perceivedPos: TacticalPosition; // What trainee sees (may lag, wander, or be spoofed!)
  altitude: number; // in meters
  heading: number; // degrees 0-360
  speed: number; // km/h
  status: UnitStatus;
  health: number; // 0 - 100%
  ammo: number; // 0 - 100%
  commsQuality: number; // 0 - 100%
  uncertaintyRadius: number; // in meters (expands as comms degrade)
  lastContactSecondsAgo: number;
  admiralty?: AdmiraltyCode; // NATO Admiralty System grading
  isGhostContact?: boolean; // Injected by cyber/EW spoofing
  isContradictory?: boolean; // When feeds disagree
  contradictoryDetail?: string;
  selected?: boolean;
}

export interface CommsMetrics {
  snr: number; // Signal-to-Noise Ratio in dB (-10 to +30 dB)
  packetLoss: number; // 0% to 100%
  latencyMs: number; // 50ms to 45000ms
  effectiveBandwidthKbps: number;
  emconLevel: 1 | 2 | 3; // 1 = Full Comms, 2 = Restricted, 3 = Strict Radio Silence
  cryptoStatus: 'LOCKED' | 'DEGRADED' | 'DESYNCHRONIZED' | 'COMPROMISED';
  activeFrequencyMHz: number;
  hoppingRateHps: number;
}

export interface RadioMessage {
  id: string;
  timestamp: string;
  senderCallsign: string;
  domain: TacticalDomain;
  text: string;
  priority: 'ROUTINE' | 'PRIORITY' | 'FLASH';
  corruptedText?: string;
  admiralty?: AdmiraltyCode;
  isContradictory?: boolean;
  audioNoiseRatio: number;
}

export interface SpoofedRadioOrder {
  id: string;
  timestamp: string;
  senderCallsign: string;
  purportedRank: string;
  orderText: string;
  claimedAction: 'FALL_BACK_IMMEDIATELY' | 'HOLD_FIRE_CEASEFIRE' | 'DISREGARD_FLANK_THREAT' | 'DIVERT_ARTILLERY';
  authenticationCode: string; // e.g. "SHACKLE: BRAVO-7"
  expectedValidCode: string;   // e.g. "SHACKLE: FOXTROT-4"
  isValidAuth: boolean;
  isDeception: boolean;
  status: 'PENDING' | 'AUTHENTICATED' | 'REJECTED_AS_DECEPTION' | 'BLINDLY_OBEYED';
  flawHint: string;
}

export interface VerificationAction {
  id: string;
  type: 
    | 'CHALLENGE_AUTHENTICATE' 
    | 'DISPATCH_PHYSICAL_RUNNER' 
    | 'CROSS_CHECK_OPTICAL_UAV' 
    | 'SWITCH_BACKUP_HF';
  label: string;
  targetRef: string;
  durationSec: number;
  remainingSec: number;
  completed: boolean;
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  commencedAtSec?: number;
  resultSummary?: string;
  isSuccessfulDeceptionExpose?: boolean;
}

export interface EMCONState {
  rfSignaturePct: number; // 0 to 100%
  adversaryDFLockPct: number; // 0 to 100% probability of artillery triangulation
  totalTransmissionsCount: number;
  timeInStrictSilenceSec: number;
  counterBatteryThreatLevel: 'LOW' | 'ELEVATED' | 'CRITICAL_LOCK_IMMINENT';
}

export interface CounterfactualDivergencePoint {
  metricName: string;
  actualValue: string;
  counterfactualValue: string;
  impact: 'CRITICAL_SAVINGS' | 'TACTICAL_ADVANTAGE' | 'RISK_MITIGATION';
}

export interface CounterfactualReplayFork {
  forkId?: string;
  decisionId: string;
  forkTimeSec?: number;
  timeSec?: number;
  originalDecision?: TraineeDecision;
  originalAction?: string;
  actualOutcomeNarrative?: string;
  alternativeAction?: TraineeDecision['actionType'];
  alternateAction?: string;
  alternativeRationale?: string;
  projectedOutcome?: string;
  counterfactualNarrative?: string;
  projectedScoreDelta?: number;
  scoreDifference?: number;
  projectedGroundTruthDeviationMeters?: number;
  ammoSaved?: number;
  projectedAmmunitionRoundsSaved?: number;
  projectedCasualtiesAvoided?: number;
  rfExposureAvoidedPct?: number;
  projectedRfSignatureAvoidedPct?: number;
  doctrineVerdict?: 'OPTIMAL_DOCTRINE' | 'SUB_OPTIMAL' | 'FRATRICIDE_AVERTED';
  doctrineTakeaway?: string;
  divergencePoints?: CounterfactualDivergencePoint[];
}

export interface TraineeDecision {
  id: string;
  timestamp: string;
  exerciseElapsedSec: number;
  commanderCallsign: string;
  actionType: 
    | 'ARTILLERY_FIRE_MISSION' 
    | 'SCRAMBLE_AIR_SUPPORT' 
    | 'DISPATCH_RECCE_DRONE' 
    | 'EMCON_SILENCE_ORDER' 
    | 'FREQUENCY_HOP_SHIFT' 
    | 'CHALLENGE_IFF_KEY' 
    | 'AUTHENTICATE_RADIO_ORDER'
    | 'HOLD_FIRE_VERIFY'
    | 'DISPATCH_MOTORCYCLE_RUNNER'
    | 'CROSS_CHECK_OPTICAL'
    | 'TACTICAL_RETREAT' 
    | 'COMMIT_RESERVE_PLATOON';
  targetUnitId?: string;
  targetCallsign?: string;
  targetPos?: TacticalPosition;
  uncertaintyAtTime: number; // Perceived uncertainty radius
  rationale: string; // MANDATORY commander rationale under fog of war
  confidenceLevel: number; // 1 to 5
  evaluatedEffect: 'ACCURATE_STRIKE' | 'FRIENDLY_FIRE_RISK' | 'MISSED_GHOST' | 'EFFECTIVE_COUNTERMEASURE' | 'SUB_OPTIMAL_DELAY';
  scoreDelta: number;
  feedback: string;
  groundTruthDeviationMeters: number; // Distance between perceived and real target at moment of order
  wasPrecededByVerification?: boolean;
  verificationMethod?: string;
  rfSignatureAtOrder?: number;
  compensationTimeSpentSec?: number;
}

export interface TimelineSnapshot {
  timeSec: number;
  label: string;
  groundTruthUnits: TacticalUnit[];
  perceivedUnits: TacticalUnit[];
  decision?: TraineeDecision;
  ewJammingKw: number;
  snr: number;
  latencySec: number;
  packetLoss: number;
  activeDisruptions: string[];
  emconState?: EMCONState;
  pendingSpoofedOrder?: SpoofedRadioOrder;
  activeVerification?: VerificationAction;
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  theater: string;
  elevation: string;
  threatLevel: 'DEFCON 3' | 'DEFCON 2' | 'DEFCON 1';
  weather: 'Clear Altitude' | 'Mountain Blizzard' | 'Severe Ionospheric Fog';
  briefing: string;
  instructorInjectDefaults: {
    ewJammerPowerKw: number;
    packetLossPct: number;
    latencySec: number;
    enableSpoofing: boolean;
    weatherPenalty: number;
  };
}

export interface TraineeRole {
  id: 'SUB_UNIT_CDR' | 'AIR_CONTROLLER' | 'EW_CYBER_OFFICER' | 'INSTRUCTOR_WHITE_CELL';
  title: string;
  rank: string;
  responsibilities: string;
  badgeColor: string;
}

