import type { 
  TacticalUnit, 
  CommsMetrics, 
  RadioMessage, 
  TraineeDecision, 
  TimelineSnapshot,
  EMCONState,
  SpoofedRadioOrder,
  VerificationAction,
  CounterfactualReplayFork
} from '../types/tactical.ts';
import type { RoleId, ServerMessage, ClientMessage, CalibrationSummary } from '../../server/types.ts';

export interface NetworkCallbacks {
  onConnected?: (roomId: string, peers: { id: string; roleId: RoleId; callsign: string }[]) => void;
  onDisconnected?: () => void;
  onTickUpdate?: (
    timeSec: number, 
    units: TacticalUnit[], 
    comms: CommsMetrics, 
    activeDisruptions: string[],
    emconState?: EMCONState,
    activeVerifications?: VerificationAction[],
    pendingSpoofedOrder?: SpoofedRadioOrder
  ) => void;
  onDecisionLogged?: (decision: TraineeDecision, snapshot: TimelineSnapshot) => void;
  onRadioBroadcast?: (message: RadioMessage, rfSignaturePct?: number) => void;
  onInjectTriggered?: (disruptionType: string, label: string) => void;
  onAARReport?: (timelineSnapshots: TimelineSnapshot[], decisions: TraineeDecision[], calibration: CalibrationSummary, narrative?: string) => void;
  onPeerChange?: (peers: { id: string; roleId: RoleId; callsign: string }[]) => void;
  onVerificationUpdate?: (verification: VerificationAction) => void;
  onSpoofedOrderInjected?: (order: SpoofedRadioOrder) => void;
  onCounterfactualResult?: (fork: CounterfactualReplayFork) => void;
}

export class TacticalNetworkClient {
  private ws: WebSocket | null = null;
  private url: string;
  private roomId: string = 'ROOM_ALPHA';
  private roleId: RoleId = 'SUB_UNIT_CDR';
  private callsign: string = 'MAJOR-COMMANDER';
  private callbacks: NetworkCallbacks = {};
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  public isConnected: boolean = false;

  constructor(serverPort: number = 3001) {
    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const host = window.location.hostname || '127.0.0.1';
      if (window.location.port === '5173') {
        this.url = `${wsProtocol}//${host}:${serverPort}`;
      } else {
        this.url = `${wsProtocol}//${window.location.host}`;
      }
    } else {
      this.url = `ws://127.0.0.1:${serverPort}`;
    }
  }

  public connect(
    roomId: string,
    roleId: RoleId,
    callsign: string,
    callbacks: NetworkCallbacks
  ) {
    this.roomId = roomId;
    this.roleId = roleId;
    this.callsign = callsign;
    this.callbacks = callbacks;

    if (this.ws) {
      try { this.ws.close(); } catch {}
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log(`[NetworkClient] Connected to Astral-C2 server at ${this.url}`);
        this.sendMessage({
          type: 'JOIN_ROOM',
          roomId: this.roomId,
          roleId: this.roleId,
          callsign: this.callsign,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[NetworkClient] Error parsing message:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('[NetworkClient] Disconnected from server');
        this.callbacks.onDisconnected?.();
      };

      this.ws.onerror = (err) => {
        console.warn('[NetworkClient] Connection error, operating in standalone local mode:', err);
      };
    } catch (e) {
      console.warn('[NetworkClient] WebSocket init error:', e);
    }
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.isConnected = false;
  }

  public switchRole(roleId: RoleId, callsign?: string) {
    this.roleId = roleId;
    if (callsign) this.callsign = callsign;
    if (this.isConnected) {
      this.sendMessage({
        type: 'JOIN_ROOM',
        roomId: this.roomId,
        roleId: this.roleId,
        callsign: this.callsign,
      });
    }
  }

  public sendMessage(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public sendDecision(decision: Omit<TraineeDecision, 'id' | 'timestamp' | 'exerciseElapsedSec' | 'evaluatedEffect' | 'scoreDelta' | 'feedback' | 'groundTruthDeviationMeters'>) {
    this.sendMessage({
      type: 'SUBMIT_DECISION',
      decision,
    });
  }

  public sendRadio(text: string, domain?: string, priority?: 'ROUTINE' | 'PRIORITY' | 'FLASH') {
    this.sendMessage({
      type: 'SEND_RADIO',
      text,
      domain,
      priority,
    });
  }

  public updateEW(intensityKw: number) {
    this.sendMessage({
      type: 'UPDATE_EW',
      intensityKw,
    });
  }

  public updateComms(metrics: Partial<CommsMetrics>) {
    this.sendMessage({
      type: 'UPDATE_COMMS',
      metrics,
    });
  }

  public injectDisruption(disruptionType: string) {
    this.sendMessage({
      type: 'INJECT_DISRUPTION',
      disruptionType,
    });
  }

  public startVerification(
    actionType: VerificationAction['type'],
    targetRef: string,
    label: string,
    durationSec: number
  ) {
    this.sendMessage({
      type: 'START_VERIFICATION',
      actionType,
      targetRef,
      label,
      durationSec,
    });
  }

  public respondSpoofedOrder(
    orderId: string,
    action: 'AUTHENTICATE' | 'REJECT_AS_DECEPTION' | 'BLINDLY_OBEY'
  ) {
    this.sendMessage({
      type: 'RESPOND_SPOOFED_ORDER',
      orderId,
      action,
    });
  }

  public requestCounterfactual(
    decisionId: string,
    alternativeAction: TraineeDecision['actionType'],
    alternativeRationale: string
  ) {
    this.sendMessage({
      type: 'REQUEST_COUNTERFACTUAL',
      decisionId,
      alternativeAction,
      alternativeRationale,
    });
  }

  public pauseSim() {
    this.sendMessage({ type: 'PAUSE_SIM' });
  }

  public resumeSim() {
    this.sendMessage({ type: 'RESUME_SIM' });
  }

  public resetSim(seed?: number) {
    this.sendMessage({ type: 'RESET_SIM', seed });
  }

  public requestAAR() {
    this.sendMessage({ type: 'REQUEST_AAR' });
  }

  public generateLLMAAR() {
    this.sendMessage({ type: 'GENERATE_LLM_AAR' });
  }

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'INIT_STATE':
        this.callbacks.onConnected?.(msg.roomId, msg.peers);
        this.callbacks.onTickUpdate?.(
          msg.exerciseTimeSec,
          msg.units,
          msg.commsMetrics,
          [],
          msg.emconState,
          msg.activeVerifications,
          msg.pendingSpoofedOrder
        );
        break;

      case 'TICK_UPDATE':
        this.callbacks.onTickUpdate?.(
          msg.exerciseTimeSec,
          msg.units,
          msg.commsMetrics,
          msg.activeDisruptions,
          msg.emconState,
          msg.activeVerifications,
          msg.pendingSpoofedOrder
        );
        break;

      case 'DECISION_LOGGED':
        this.callbacks.onDecisionLogged?.(msg.decision, msg.snapshot);
        break;

      case 'RADIO_BROADCAST':
        this.callbacks.onRadioBroadcast?.(msg.message, msg.rfSignaturePct);
        break;

      case 'VERIFICATION_UPDATE':
        this.callbacks.onVerificationUpdate?.(msg.verification);
        break;

      case 'SPOOFED_ORDER_INJECTED':
        this.callbacks.onSpoofedOrderInjected?.(msg.order);
        break;

      case 'COUNTERFACTUAL_RESULT':
        this.callbacks.onCounterfactualResult?.(msg.fork);
        break;

      case 'INJECT_TRIGGERED':
        this.callbacks.onInjectTriggered?.(msg.disruptionType, msg.label);
        break;

      case 'AAR_REPORT':
        this.callbacks.onAARReport?.(
          msg.timelineSnapshots,
          msg.decisions,
          msg.calibrationScore,
          msg.llmNarrative
        );
        break;

      case 'PEER_CHANGE':
        this.callbacks.onPeerChange?.(msg.peers);
        break;

      case 'ERROR':
        console.error('[NetworkClient] Server error:', msg.message);
        break;
    }
  }
}

export const networkClient = new TacticalNetworkClient(3001);
