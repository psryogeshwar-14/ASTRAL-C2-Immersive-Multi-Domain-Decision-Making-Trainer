import type { TimelineSnapshot, TraineeDecision, RadioMessage } from '../../src/types/tactical.ts';

export type EventType = 
  | 'SESSION_START'
  | 'TICK_SNAPSHOT'
  | 'INJECT_APPLIED'
  | 'RADIO_TRANSMITTED'
  | 'DECISION_LOGGED'
  | 'COMMS_OVERRIDE'
  | 'ROLE_CONNECTED'
  | 'ROLE_DISCONNECTED';

export interface LoggedEvent {
  index: number;
  simTimeSec: number;
  wallClockMs: number;
  eventType: EventType;
  actorRoleId?: string;
  actorCallsign?: string;
  payload: unknown;
  snapshotHash: string;
}

export class SimulationEventLog {
  private events: LoggedEvent[] = [];
  private rollingHash: number = 0x811c9dc5; // FNV-1a 32-bit offset basis

  constructor(public readonly sessionId: string, public readonly seed: number) {
    this.append('SESSION_START', 0, { sessionId, seed }, 'SYSTEM', 'WHITE_CELL');
  }

  /**
   * Fast deterministic hash for event integrity verification.
   */
  private computeHash(str: string): string {
    let hash = this.rollingHash;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    this.rollingHash = hash;
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  public append(
    eventType: EventType,
    simTimeSec: number,
    payload: unknown,
    actorRoleId: string = 'SYSTEM',
    actorCallsign: string = 'WHITE_CELL'
  ): LoggedEvent {
    const payloadStr = JSON.stringify(payload);
    const hash = this.computeHash(`${eventType}:${simTimeSec}:${payloadStr}`);

    const event: LoggedEvent = {
      index: this.events.length,
      simTimeSec,
      wallClockMs: Date.now(),
      eventType,
      actorRoleId,
      actorCallsign,
      payload,
      snapshotHash: hash,
    };

    this.events.push(event);
    return event;
  }

  public getEvents(): readonly LoggedEvent[] {
    return this.events;
  }

  public getDecisions(): TraineeDecision[] {
    return this.events
      .filter(e => e.eventType === 'DECISION_LOGGED')
      .map(e => e.payload as TraineeDecision);
  }

  public getTimelineSnapshots(): TimelineSnapshot[] {
    return this.events
      .filter(e => e.eventType === 'TICK_SNAPSHOT')
      .map(e => e.payload as TimelineSnapshot);
  }

  public getRadioMessages(): RadioMessage[] {
    return this.events
      .filter(e => e.eventType === 'RADIO_TRANSMITTED')
      .map(e => e.payload as RadioMessage);
  }

  public exportAuditRecord(): {
    sessionId: string;
    seed: number;
    totalEvents: number;
    initialHash: string;
    finalHash: string;
    events: LoggedEvent[];
  } {
    return {
      sessionId: this.sessionId,
      seed: this.seed,
      totalEvents: this.events.length,
      initialHash: this.events[0]?.snapshotHash || '00000000',
      finalHash: this.events[this.events.length - 1]?.snapshotHash || '00000000',
      events: this.events,
    };
  }
}
