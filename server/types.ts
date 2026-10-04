import type { 
  TacticalUnit, 
  CommsMetrics, 
  RadioMessage, 
  TraineeDecision, 
  TimelineSnapshot,
  ScenarioDefinition,
  EMCONState,
  SpoofedRadioOrder,
  VerificationAction,
  CounterfactualReplayFork
} from '../src/types/tactical.ts';

export type RoleId = 'INSTRUCTOR_WHITE_CELL' | 'SUB_UNIT_CDR' | 'AIR_CONTROLLER' | 'EW_CYBER_OFFICER';

export interface RoomClient {
  id: string;
  roleId: RoleId;
  callsign: string;
  joinedAt: number;
}

export interface SimRoomState {
  roomId: string;
  scenario: ScenarioDefinition;
  exerciseTimeSec: number;
  isPaused: boolean;
  seed: number;
  groundTruthUnits: TacticalUnit[];
  commsMetrics: CommsMetrics;
  ewJammingIntensity: number;
  radioChatter: RadioMessage[];
  decisions: TraineeDecision[];
  timelineSnapshots: TimelineSnapshot[];
  activeDisruptions: string[];
  emconState: EMCONState;
  activeVerifications: VerificationAction[];
  pendingSpoofedOrder?: SpoofedRadioOrder;
}

// Client-to-Server Messages
export type ClientMessage =
  | { type: 'JOIN_ROOM'; roomId: string; roleId: RoleId; callsign: string }
  | { type: 'PAUSE_SIM' }
  | { type: 'RESUME_SIM' }
  | { type: 'RESET_SIM'; seed?: number }
  | { type: 'UPDATE_COMMS'; metrics: Partial<CommsMetrics> }
  | { type: 'UPDATE_EW'; intensityKw: number }
  | { type: 'INJECT_DISRUPTION'; disruptionType: string; payload?: unknown }
  | { type: 'SEND_RADIO'; text: string; domain?: string; priority?: 'ROUTINE' | 'PRIORITY' | 'FLASH' }
  | { type: 'SUBMIT_DECISION'; decision: Omit<TraineeDecision, 'id' | 'timestamp' | 'exerciseElapsedSec' | 'evaluatedEffect' | 'scoreDelta' | 'feedback' | 'groundTruthDeviationMeters'> }
  | { type: 'START_VERIFICATION'; actionType: VerificationAction['type']; targetRef: string; label: string; durationSec: number }
  | { type: 'RESPOND_SPOOFED_ORDER'; orderId: string; action: 'AUTHENTICATE' | 'REJECT_AS_DECEPTION' | 'BLINDLY_OBEY' }
  | { type: 'REQUEST_COUNTERFACTUAL'; decisionId: string; alternativeAction: TraineeDecision['actionType']; alternativeRationale: string }
  | { type: 'REQUEST_AAR' }
  | { type: 'GENERATE_LLM_AAR' };

// Server-to-Client Messages
export type ServerMessage =
  | { 
      type: 'INIT_STATE'; 
      roomId: string; 
      roleId: RoleId; 
      exerciseTimeSec: number; 
      isPaused: boolean;
      scenario: ScenarioDefinition;
      units: TacticalUnit[]; 
      commsMetrics: CommsMetrics; 
      ewJammingIntensity: number; 
      radioChatter: RadioMessage[]; 
      decisions: TraineeDecision[];
      showGroundTruth: boolean;
      peers: { id: string; roleId: RoleId; callsign: string }[];
      emconState: EMCONState;
      activeVerifications: VerificationAction[];
      pendingSpoofedOrder?: SpoofedRadioOrder;
    }
  | { 
      type: 'TICK_UPDATE'; 
      exerciseTimeSec: number; 
      units: TacticalUnit[]; 
      commsMetrics: CommsMetrics; 
      radioChatter?: RadioMessage[];
      activeDisruptions: string[];
      emconState: EMCONState;
      activeVerifications: VerificationAction[];
      pendingSpoofedOrder?: SpoofedRadioOrder;
    }
  | { 
      type: 'DECISION_LOGGED'; 
      decision: TraineeDecision; 
      snapshot: TimelineSnapshot;
    }
  | { 
      type: 'RADIO_BROADCAST'; 
      message: RadioMessage; 
      rfSignaturePct: number;
    }
  | { 
      type: 'VERIFICATION_UPDATE'; 
      verification: VerificationAction; 
    }
  | { 
      type: 'SPOOFED_ORDER_INJECTED'; 
      order: SpoofedRadioOrder; 
    }
  | { 
      type: 'COUNTERFACTUAL_RESULT'; 
      fork: CounterfactualReplayFork; 
    }
  | { 
      type: 'INJECT_TRIGGERED'; 
      disruptionType: string; 
      label: string; 
      timestamp: number;
    }
  | { 
      type: 'AAR_REPORT'; 
      sessionId: string;
      timelineSnapshots: TimelineSnapshot[];
      decisions: TraineeDecision[];
      calibrationScore: CalibrationSummary;
      llmNarrative?: string;
    }
  | { 
      type: 'PEER_CHANGE'; 
      peers: { id: string; roleId: RoleId; callsign: string }[];
    }
  | { 
      type: 'ERROR'; 
      message: string; 
    };

export interface CalibrationSummary {
  totalDecisions: number;
  calibratedDecisions: number;
  overconfidentDecisions: number;
  hesitantDecisions: number;
  avgConfidence: number; // 1.0 - 5.0
  avgInfoAgeSec: number;
  avgGroundTruthErrorMeters: number;
  calibrationIndex: number; // 0.0 to 1.0 (1.0 = perfectly calibrated)
  brierScore: number;
  verdict: 'EXCELLENT_CALIBRATION' | 'OVERCONFIDENT_BIAS' | 'EXCESSIVE_RISK_AVERSION' | 'UNTESTED';
  // Advanced Compensation & EMCON Metrics
  verificationRatePct: number; // % of kinetic decisions preceded by verification
  compensationScore: number; // 0 to 100
  spoofedOrdersDetected: number;
  spoofedOrdersBlown: number;
  peakRfSignaturePct: number;
  counterBatteryAlertCount: number;
}
