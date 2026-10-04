import type { 
  TacticalUnit, 
  CommsMetrics, 
  AdmiraltyCode 
} from '../../src/types/tactical.ts';
import type { RoleId } from '../types.ts';
import { SeededPRNG } from './prng.ts';

export class DegradationLayer {
  private prng: SeededPRNG;

  constructor(seed: number = 42) {
    this.prng = new SeededPRNG(seed);
  }

  /**
   * Re-seeds the degradation engine for deterministic re-runs.
   */
  public reseed(seed: number) {
    this.prng = new SeededPRNG(seed);
  }

  /**
   * Computes dynamic RF and IP comms metrics given current EW jammer power,
   * active cyber exploits, and atmospheric weather penalties.
   */
  public computeCommsMetrics(
    base: CommsMetrics,
    ewJammingKw: number,
    weatherPenalty: number = 0
  ): CommsMetrics {
    // Jitter from atmospheric multipath and ionospheric scatter
    const snrJitter = this.prng.nextRange(-0.8, 0.8);
    const rawSnr = 26 - (ewJammingKw * 0.32) - (weatherPenalty * 0.25) + snrJitter;
    const snr = Math.round(Math.max(-8, Math.min(30, rawSnr)) * 10) / 10;

    // Packet loss scales non-linearly with EW power once SNR falls below threshold
    const lossJitter = this.prng.nextRange(-3, 3);
    const snrDeficit = Math.max(0, 12 - snr);
    const calculatedLoss = (ewJammingKw * 0.5) + (snrDeficit * 2.8) + (weatherPenalty * 0.4) + lossJitter;
    const packetLoss = Math.round(Math.max(0, Math.min(95, calculatedLoss)));

    // Latency spikes under retransmission floods
    const latencyJitter = this.prng.nextRange(-400, 600);
    const retransmissionFactor = 1 + (packetLoss / 30);
    const rawLatency = (base.latencyMs * retransmissionFactor) + (ewJammingKw * 140) + latencyJitter;
    const latencyMs = Math.round(Math.max(80, Math.min(45000, rawLatency)));

    // Crypto sync degradation
    let cryptoStatus: CommsMetrics['cryptoStatus'] = 'LOCKED';
    if (packetLoss > 70) {
      cryptoStatus = 'DESYNCHRONIZED';
    } else if (ewJammingKw > 65 || packetLoss > 40) {
      cryptoStatus = 'DEGRADED';
    }

    const effectiveBandwidth = Math.round(Math.max(0.5, 64 * (1 - packetLoss / 100) * (Math.max(0, snr + 5) / 35)) * 10) / 10;

    return {
      ...base,
      snr,
      packetLoss,
      latencyMs,
      effectiveBandwidthKbps: effectiveBandwidth,
      cryptoStatus,
    };
  }

  /**
   * Filters and degrades the canonical Ground Truth into a role-specific perception.
   * Trainees see delayed, wandering, or missing contacts, while Instructors see truth vs perception.
   */
  public projectUnitsForRole(
    groundTruthUnits: TacticalUnit[],
    roleId: RoleId,
    commsMetrics: CommsMetrics,
    simTimeSec: number
  ): TacticalUnit[] {
    // Instructor / White Cell sees units with exact ground truth positions intact
    if (roleId === 'INSTRUCTOR_WHITE_CELL') {
      return groundTruthUnits.map(unit => ({
        ...unit,
        selected: false,
      }));
    }

    return groundTruthUnits
      .filter(unit => {
        // Air controllers primarily see airborne contacts, high terrain radars, and laser designators
        if (roleId === 'AIR_CONTROLLER' && unit.domain === 'LAND' && unit.affiliation === 'OPFOR') {
          // If ground unit is hidden in gorge with no air spotting, mask it
          if (unit.id === 'OPFOR-SPECIAL-FORCES' && commsMetrics.packetLoss > 20) {
            return false;
          }
        }
        return true;
      })
      .map(unit => {
        return this.degradeSingleUnit(unit, roleId, commsMetrics, simTimeSec);
      });
  }

  /**
   * Degrades a single unit's telemetry based on comms latency, GPS spoofing, and source reliability.
   */
  private degradeSingleUnit(
    unit: TacticalUnit,
    roleId: RoleId,
    commsMetrics: CommsMetrics,
    _simTimeSec: number
  ): TacticalUnit {
    // Calculate telemetry age based on packet loss and latency
    const latencySec = commsMetrics.latencyMs / 1000;
    const packetDropOccurred = this.prng.next() < (commsMetrics.packetLoss / 100);

    const contactAge = packetDropOccurred 
      ? unit.lastContactSecondsAgo + 1 
      : Math.floor(latencySec);

    // Coordinate lag: the unit's perceived position lags behind its actual position by latency
    // If unit is moving, position lag = direction * speed * latencySec
    const dx = unit.groundTruthPos.x - unit.perceivedPos.x;
    const dz = unit.groundTruthPos.z - unit.perceivedPos.z;

    // Responsiveness factor decreases as latency rises
    const followRate = Math.max(0.04, Math.min(1.0, 1.0 - (latencySec / 35)));

    // GPS / multipath position jitter
    const jitterMagnitude = (commsMetrics.packetLoss > 30) ? 0.35 : 0.05;
    const jitterX = this.prng.nextRange(-jitterMagnitude, jitterMagnitude);
    const jitterZ = this.prng.nextRange(-jitterMagnitude, jitterMagnitude);

    const newPerceivedX = unit.perceivedPos.x + (dx * followRate) + jitterX;
    const newPerceivedZ = unit.perceivedPos.z + (dz * followRate) + jitterZ;

    // Circular Error Probable (CEP) expands as information ages
    const baseUncertainty = unit.affiliation === 'BLUFOR' ? 80 : 350;
    const expansionRate = (commsMetrics.packetLoss > 40) ? 9 : 3.5;
    const uncertaintyRadius = Math.round(
      Math.min(2200, baseUncertainty + (contactAge * expansionRate) + (commsMetrics.latencyMs / 60))
    );

    // Calculate dynamic NATO Admiralty system grade degradation
    const admiralty = this.computeAdmiraltyDecay(unit.admiralty, contactAge);

    // Unit status reflects comms state
    let status = unit.status;
    if (unit.commsQuality < 10 || contactAge > 120) {
      status = 'SILENT';
    } else if (commsMetrics.packetLoss > 45) {
      status = 'DEGRADED';
    }

    return {
      ...unit,
      perceivedPos: {
        ...unit.perceivedPos,
        x: newPerceivedX,
        z: newPerceivedZ,
      },
      lastContactSecondsAgo: contactAge,
      uncertaintyRadius,
      status,
      admiralty,
      commsQuality: Math.max(0, Math.round(100 - commsMetrics.packetLoss - (commsMetrics.latencyMs / 400))),
    };
  }

  /**
   * Applies NATO Admiralty Rating degradation (e.g. A1 fresh -> B2 aging -> C3 stale).
   */
  private computeAdmiraltyDecay(current?: AdmiraltyCode, ageSec: number = 0): AdmiraltyCode | undefined {
    if (!current) return undefined;

    let cred: AdmiraltyCode['credibility'] = current.credibility;
    if (ageSec > 180) {
      cred = Math.min(6, (current.credibility + 2)) as AdmiraltyCode['credibility'];
    } else if (ageSec > 60) {
      cred = Math.min(6, (current.credibility + 1)) as AdmiraltyCode['credibility'];
    }

    return {
      ...current,
      ageSec,
      credibility: cred,
    };
  }

  /**
   * Corrupts radio transcript text based on packet loss and SNR.
   */
  public degradeRadioText(originalText: string, commsMetrics: CommsMetrics): {
    corruptedText: string;
    audioNoiseRatio: number;
    wasDelayed: boolean;
  } {
    const audioNoiseRatio = Math.max(0.05, Math.min(0.95, (25 - commsMetrics.snr) / 35));
    const dropRate = commsMetrics.packetLoss / 100;

    if (dropRate < 0.15) {
      return { corruptedText: originalText, audioNoiseRatio, wasDelayed: false };
    }

    const chars = originalText.split('');
    const corruptChars = ['#', '.', '•', '~', '?', ' '];

    const corrupted = chars.map((char) => {
      if (char === ' ' || char === '\n') return char;
      if (this.prng.next() < (dropRate * 0.45)) {
        return corruptChars[this.prng.nextInt(0, corruptChars.length - 1)];
      }
      return char;
    }).join('');

    return {
      corruptedText: corrupted,
      audioNoiseRatio,
      wasDelayed: commsMetrics.latencyMs > 4000,
    };
  }
}
