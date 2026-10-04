import type { 
  TacticalUnit, 
  CommsMetrics, 
  RadioMessage, 
  TraineeDecision, 
  ScenarioDefinition,
  TimelineSnapshot,
  EMCONState,
  SpoofedRadioOrder,
  VerificationAction,
  CounterfactualReplayFork
} from '../../src/types/tactical.ts';
import type { RoleId } from '../types.ts';
import { SeededPRNG } from './prng.ts';
import { DegradationLayer } from './degradationLayer.ts';
import { SimulationEventLog } from './eventLog.ts';

export class GroundTruthEngine {
  private prng: SeededPRNG;
  private degradation: DegradationLayer;
  public readonly eventLog: SimulationEventLog;

  private exerciseTimeSec: number = 0;
  private isPaused: boolean = false;
  private units: TacticalUnit[];
  private commsMetrics: CommsMetrics;
  private ewJammingIntensity: number;
  private activeDisruptions: Set<string> = new Set();
  private radioChatter: RadioMessage[] = [];
  private decisions: TraineeDecision[] = [];
  private timelineSnapshots: TimelineSnapshot[] = [];

  // MUST FEATURE 1: Active Deception & Spoofed Orders
  private pendingSpoofedOrder?: SpoofedRadioOrder;

  // MUST FEATURE 2: Compensation / Verification Pipelines
  private activeVerifications: VerificationAction[] = [];
  private recentVerificationSuccess: { [targetId: string]: number } = {}; // targetId -> expiry time

  // MUST FEATURE 3: Emission-Control (EMCON) Physics
  private emconState: EMCONState = {
    rfSignaturePct: 18,
    adversaryDFLockPct: 0,
    totalTransmissionsCount: 0,
    timeInStrictSilenceSec: 0,
    counterBatteryThreatLevel: 'LOW',
  };

  constructor(
    public readonly sessionId: string,
    public readonly scenario: ScenarioDefinition,
    public readonly seed: number = 1337,
    initialUnits: TacticalUnit[],
    initialComms: CommsMetrics,
    initialRadio: RadioMessage[]
  ) {
    this.prng = new SeededPRNG(seed);
    this.degradation = new DegradationLayer(seed);
    this.eventLog = new SimulationEventLog(sessionId, seed);

    this.units = JSON.parse(JSON.stringify(initialUnits));
    this.commsMetrics = { ...initialComms };
    this.ewJammingIntensity = scenario.instructorInjectDefaults.ewJammerPowerKw;
    this.radioChatter = [...initialRadio];

    // Initial snapshot at T+0
    this.recordSnapshot('Scenario Initialization (T+00:00)');
  }

  public getExerciseTime(): number {
    return this.exerciseTimeSec;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    this.eventLog.append('COMMS_OVERRIDE', this.exerciseTimeSec, { isPaused: paused });
  }

  public getGroundTruthUnits(): TacticalUnit[] {
    return this.units;
  }

  public getCommsMetrics(): CommsMetrics {
    return this.commsMetrics;
  }

  public getEWIntensity(): number {
    return this.ewJammingIntensity;
  }

  public getRadioChatter(): RadioMessage[] {
    return this.radioChatter;
  }

  public getDecisions(): TraineeDecision[] {
    return this.decisions;
  }

  public getTimelineSnapshots(): TimelineSnapshot[] {
    return this.timelineSnapshots;
  }

  public getActiveDisruptions(): string[] {
    return Array.from(this.activeDisruptions);
  }

  public getEMCONState(): EMCONState {
    return { ...this.emconState };
  }

  public getActiveVerifications(): VerificationAction[] {
    return [...this.activeVerifications];
  }

  public getPendingSpoofedOrder(): SpoofedRadioOrder | undefined {
    return this.pendingSpoofedOrder ? { ...this.pendingSpoofedOrder } : undefined;
  }

  /**
   * Primary Simulation Tick (invoked every 1000ms by the server loop).
   */
  public tick(): {
    exerciseTimeSec: number;
    timelineSnapshot?: TimelineSnapshot;
    newRadioMessages?: RadioMessage[];
    emconAlert?: string;
  } {
    if (this.isPaused) {
      return { exerciseTimeSec: this.exerciseTimeSec };
    }

    this.exerciseTimeSec += 1;

    // 1. Update physical kinematics of units in ground truth
    this.updateUnitKinematics();

    // 2. Recompute dynamic RF comms metrics via DegradationLayer
    this.commsMetrics = this.degradation.computeCommsMetrics(
      this.commsMetrics,
      this.ewJammingIntensity,
      this.scenario.instructorInjectDefaults.weatherPenalty
    );

    // 3. Update Verification / Compensation Action Timers
    this.updateVerificationTimers();

    // 4. Update EMCON Physics (RF signature decay vs enemy DF lock growth)
    const emconAlert = this.updateEMCONPhysics();

    // 5. Check for automatic scenario script injects
    this.checkScriptedInjects();

    // 6. Capture periodic 15-second AAR snapshots for replay scrubber
    let snapshot: TimelineSnapshot | undefined;
    if (this.exerciseTimeSec % 15 === 0) {
      snapshot = this.recordSnapshot(`Periodic State (T+${this.formatClock(this.exerciseTimeSec)})`);
    }

    return {
      exerciseTimeSec: this.exerciseTimeSec,
      timelineSnapshot: snapshot,
      emconAlert,
    };
  }

  /**
   * Updates Verification & Compensation Timers (runner, optical UAV, shackle challenge).
   */
  private updateVerificationTimers() {
    this.activeVerifications = this.activeVerifications.map(v => {
      if (v.completed) return v;
      const remainingSec = Math.max(0, v.remainingSec - 1);
      if (remainingSec === 0) {
        // Complete verification!
        let resultSummary = 'Verification complete. Telemetry verified against optical ground line.';
        let isSuccessfulDeceptionExpose = false;

        const target = this.units.find(u => u.id === v.targetRef);
        if (target?.isGhostContact) {
          resultSummary = 'ALERT: Optical gimbal confirms coordinates are completely vacant! Target is a cyber deception phantom.';
          isSuccessfulDeceptionExpose = true;
        } else if (v.type === 'CHALLENGE_AUTHENTICATE' && this.pendingSpoofedOrder) {
          resultSummary = 'SHACKLE CHALLENGE FAILED: Authenticator returned invalid code. Order is an enemy psychological warfare spoof!';
          isSuccessfulDeceptionExpose = true;
          this.pendingSpoofedOrder.status = 'REJECTED_AS_DECEPTION';
        } else if (target) {
          // Reveal true position to trainee for 60 seconds
          this.recentVerificationSuccess[target.id] = this.exerciseTimeSec + 60;
          resultSummary = `RECON CONFIRMED: ${target.callsign} true location fixed at MGRS ${target.groundTruthPos.gridRef}. CEP reduced to 30m.`;
        }

        this.transmitRadioMessage({
          senderCallsign: 'RECCE-SCREEN',
          domain: 'LAND',
          text: `VERIFICATION RESULT: ${resultSummary}`,
          priority: 'PRIORITY',
        });

        return {
          ...v,
          remainingSec: 0,
          completed: true,
          resultSummary,
          isSuccessfulDeceptionExpose,
        };
      }
      return { ...v, remainingSec };
    });
  }

  /**
   * EMCON Physics Engine:
   * Radios radiating in combat net elevate probability of intercept (POI).
   * Hostile Direction Finding (DF) units triangulate emission nodes.
   */
  private updateEMCONPhysics(): string | undefined {
    let alert: string | undefined;

    // Natural decay during silence
    if (this.emconState.rfSignaturePct > 8) {
      this.emconState.rfSignaturePct = Math.max(8, Math.round((this.emconState.rfSignaturePct - 1.2) * 10) / 10);
      this.emconState.timeInStrictSilenceSec += 1;
    }

    // High RF signature feeds enemy DF triangulation
    if (this.emconState.rfSignaturePct > 60) {
      const lockGrowth = (this.emconState.rfSignaturePct - 50) * 0.08;
      this.emconState.adversaryDFLockPct = Math.min(100, Math.round((this.emconState.adversaryDFLockPct + lockGrowth) * 10) / 10);
    } else {
      // DF lock degrades if silence maintained
      this.emconState.adversaryDFLockPct = Math.max(0, Math.round((this.emconState.adversaryDFLockPct - 0.8) * 10) / 10);
    }

    // Threat level calculation
    if (this.emconState.adversaryDFLockPct >= 85) {
      this.emconState.counterBatteryThreatLevel = 'CRITICAL_LOCK_IMMINENT';
      if (this.emconState.adversaryDFLockPct >= 95 && !this.activeDisruptions.has('Counter-Battery Salvo')) {
        this.activeDisruptions.add('Counter-Battery Salvo');
        alert = 'HOSTILE COUNTER-BATTERY DF LOCK ACHIEVED! ENEMY BM-30 ROCKET SALVO EN ROUTE TO CP!';
        this.transmitRadioMessage({
          senderCallsign: 'SAMYUKTA-SIGINT',
          domain: 'EW',
          text: 'FLASH IMMEDIATE: Enemy counter-battery radar has fixed our VHF emission point! Inbound rocket salvo! DISPERSE COMMAND POST NOW!',
          priority: 'FLASH',
        });
      }
    } else if (this.emconState.adversaryDFLockPct >= 45) {
      this.emconState.counterBatteryThreatLevel = 'ELEVATED';
    } else {
      this.emconState.counterBatteryThreatLevel = 'LOW';
    }

    return alert;
  }

  /**
   * Deterministic Kinematics for Ground and Air contacts.
   */
  private updateUnitKinematics() {
    this.units = this.units.map(unit => {
      // OPFOR Armor column moving through mountain defile
      if (unit.id === 'OPFOR-ARMOR-COLUMN') {
        const speedKmh = 28;
        const deltaX = -0.06;
        const deltaZ = 0.035;

        const newTrueX = unit.groundTruthPos.x + deltaX;
        const newTrueZ = unit.groundTruthPos.z + deltaZ;

        return {
          ...unit,
          speed: speedKmh,
          groundTruthPos: {
            ...unit.groundTruthPos,
            x: newTrueX,
            z: newTrueZ,
            gridRef: `43X MH ${Math.round(4000 + (newTrueX + 100) * 20)} ${Math.round(8000 + (newTrueZ + 100) * 15)}`,
          },
          lastContactSecondsAgo: unit.lastContactSecondsAgo + 1,
        };
      }

      // OPFOR loitering munition swarm circling in orbit
      if (unit.id === 'OPFOR-LOITERING-SWARM') {
        const angularVelocity = 0.04;
        const radius = 9;
        const angle = this.exerciseTimeSec * angularVelocity;
        const newX = 14 + Math.cos(angle) * radius;
        const newZ = 6 + Math.sin(angle) * radius;

        return {
          ...unit,
          groundTruthPos: {
            ...unit.groundTruthPos,
            x: newX,
            z: newZ,
          },
          lastContactSecondsAgo: unit.lastContactSecondsAgo + 1,
        };
      }

      // Cyber ghost contact drifts to confuse air defense
      if (unit.isGhostContact) {
        return {
          ...unit,
          perceivedPos: {
            ...unit.perceivedPos,
            x: unit.perceivedPos.x - 0.12,
            z: unit.perceivedPos.z + 0.08,
          },
          lastContactSecondsAgo: unit.lastContactSecondsAgo + 1,
        };
      }

      return {
        ...unit,
        lastContactSecondsAgo: unit.lastContactSecondsAgo + 1,
      };
    });
  }

  /**
   * Checks whether the scenario definition has timed injects that should fire.
   */
  private checkScriptedInjects() {
    // T+25s: Krasukha-4 mobile EW unit spins up
    if (this.exerciseTimeSec === 25 && !this.activeDisruptions.has('Krasukha-4 Jamming Surge')) {
      this.applyEWIntensity(75);
      this.activeDisruptions.add('Krasukha-4 Jamming Surge');
      this.transmitRadioMessage({
        senderCallsign: 'SAMYUKTA-EW',
        domain: 'EW',
        text: 'FLASH: High-power RF noise floor elevation detected across 30-88 MHz band. Krasukha-4 emitter active on bearing 342. Switch to FHSS.',
        priority: 'FLASH',
      });
    }

    // T+50s: Hostile Spoofed Order Injected (AI Deception Voice)
    if (this.exerciseTimeSec === 50 && !this.pendingSpoofedOrder) {
      this.injectSpoofedOrder();
    }

    // T+75s: Cyber Phantom Bogey on Datalink
    if (this.exerciseTimeSec === 75 && !this.activeDisruptions.has('Cyber Phantom Bogey')) {
      this.injectGhostTrack();
      this.activeDisruptions.add('Cyber Phantom Bogey');
    }

    // T+110s: Contradictory Telemetry Report
    if (this.exerciseTimeSec === 110 && !this.activeDisruptions.has('Contradictory Intel')) {
      this.injectContradictoryIntel();
      this.activeDisruptions.add('Contradictory Intel');
    }

    // T+170s: Mountain Ridge Comms Blackout on Charlie Company
    if (this.exerciseTimeSec === 170 && !this.activeDisruptions.has('Charlie Repeater Blackout')) {
      this.injectRadioBlackout('BLU-CHARLIE');
      this.activeDisruptions.add('Charlie Repeater Blackout');
    }
  }

  /**
   * Projects unit state specifically for a given client's role.
   * If a unit was recently verified via runner or UAV, its perceived location snaps to truth!
   */
  public getUnitsForRole(roleId: RoleId): TacticalUnit[] {
    const rawProjected = this.degradation.projectUnitsForRole(
      this.units,
      roleId,
      this.commsMetrics,
      this.exerciseTimeSec
    );

    // If trainee recently completed a verification action on this unit, show true location
    return rawProjected.map(unit => {
      const verifiedUntil = this.recentVerificationSuccess[unit.id];
      if (verifiedUntil && verifiedUntil > this.exerciseTimeSec) {
        return {
          ...unit,
          perceivedPos: { ...unit.groundTruthPos },
          uncertaintyRadius: 40,
          admiralty: {
            reliability: 'A',
            credibility: 1,
            source: 'Recent Optical/Runner Verification',
            ageSec: Math.max(0, 60 - (verifiedUntil - this.exerciseTimeSec)),
          }
        };
      }
      return unit;
    });
  }

  /**
   * Initiates a compensation/verification pipeline (costs time).
   */
  public startVerification(
    type: VerificationAction['type'],
    targetRef: string,
    label: string,
    durationSec: number
  ): VerificationAction {
    const action: VerificationAction = {
      id: `VERIF-${Date.now().toString(36)}`,
      type,
      label,
      targetRef,
      durationSec,
      remainingSec: durationSec,
      completed: false,
    };

    this.activeVerifications.push(action);
    this.eventLog.append('INJECT_APPLIED', this.exerciseTimeSec, {
      type: 'VERIFICATION_INITIATED',
      action,
    }, 'SUB_UNIT_CDR', 'COMMANDER');

    this.transmitRadioMessage({
      senderCallsign: 'TAC-NET',
      domain: 'LAND',
      text: `DISCIPLINE: Initiating ${label} on target [${targetRef}]. Verification duration: ${durationSec}s. Hold fire pending corroboration.`,
      priority: 'ROUTINE',
    });

    return action;
  }

  /**
   * Injects an enemy spoofed order (AI deception / captured net).
   */
  public injectSpoofedOrder(): SpoofedRadioOrder {
    const spoof: SpoofedRadioOrder = {
      id: `SPOOF-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      senderCallsign: 'BRIGADE-COMMAND-NET',
      purportedRank: 'Brigadier G.S.',
      orderText: 'FLASH DIRECTIVE: Threat axis shifted to western pass. Fall back immediately from Trishul Ridge to secondary rally point MH 6500. Heavy air strike imminent on your current grid.',
      claimedAction: 'FALL_BACK_IMMEDIATELY',
      authenticationCode: 'SHACKLE: BRAVO-7', // Invalid! Valid is FOXTROT-4
      expectedValidCode: 'SHACKLE: FOXTROT-4',
      isValidAuth: false,
      isDeception: true,
      status: 'PENDING',
      flawHint: 'Transmitted with non-matching hourly Shackle table and unfamiliar cadence.',
    };

    this.pendingSpoofedOrder = spoof;
    this.activeDisruptions.add('Deceptive Radio Order Injected');

    this.transmitRadioMessage({
      senderCallsign: 'BRIGADE-COMMAND-NET',
      domain: 'LAND',
      text: 'FLASH DIRECTIVE: All sub-units on Trishul Ridge fall back immediately to secondary rally point MH 6500. Heavy air strike scheduled on your defile! AUTH: SHACKLE BRAVO-7.',
      priority: 'FLASH',
    });

    this.eventLog.append('INJECT_APPLIED', this.exerciseTimeSec, {
      type: 'SPOOFED_ORDER_INJECTED',
      spoof,
    }, 'INSTRUCTOR_WHITE_CELL', 'OPFOR_DECEPTION');

    return spoof;
  }

  /**
   * Trainee response to a spoofed order.
   */
  public respondToSpoofedOrder(
    orderId: string,
    action: 'AUTHENTICATE' | 'REJECT_AS_DECEPTION' | 'BLINDLY_OBEY'
  ): { scoreDelta: number; feedback: string } {
    if (!this.pendingSpoofedOrder || this.pendingSpoofedOrder.id !== orderId) {
      return { scoreDelta: 0, feedback: 'Order expired or already resolved.' };
    }

    let scoreDelta = 0;
    let feedback = '';

    if (action === 'AUTHENTICATE') {
      this.pendingSpoofedOrder.status = 'AUTHENTICATED';
      this.startVerification('CHALLENGE_AUTHENTICATE', orderId, 'Cryptographic Shackle Challenge', 15);
      scoreDelta = 15;
      feedback = 'DISCIPLINE: Challenged radio order against master crypto key. Verification in progress.';
    } else if (action === 'REJECT_AS_DECEPTION') {
      this.pendingSpoofedOrder.status = 'REJECTED_AS_DECEPTION';
      scoreDelta = 30;
      feedback = 'OUTSTANDING C2 INSTINCT: Recognized invalid Shackle authentication! Prevented catastrophic abandonment of defensive ridgeline.';
      this.transmitRadioMessage({
        senderCallsign: 'SUB-UNIT-CDR',
        domain: 'LAND',
        text: 'COMMAND NET: Disregard previous withdrawal order! Transmission was unauthorized adversary deception. All units hold Trishul Ridge!',
        priority: 'FLASH',
      });
    } else if (action === 'BLINDLY_OBEY') {
      this.pendingSpoofedOrder.status = 'BLINDLY_OBEYED';
      scoreDelta = -40;
      feedback = 'CRITICAL DECEPTION COLLAPSE: Commander blindly obeyed unauthenticated spoofed order! Abandoned high ground; OPFOR mechanized column seized ridge without firing a shot.';
    }

    this.eventLog.append('DECISION_LOGGED', this.exerciseTimeSec, {
      type: 'SPOOF_ORDER_RESPONSE',
      orderId,
      action,
      scoreDelta,
      feedback,
    }, 'SUB_UNIT_CDR', 'COMMANDER');

    return { scoreDelta, feedback };
  }

  /**
   * MUST FEATURE 4: Counterfactual Replay Engine
   * Deterministically rewinds to any past decision point, evaluates an alternate command choice,
   * and computes projected survival, score delta, and ammunition savings.
   */
  public generateCounterfactual(
    decisionId: string,
    alternativeAction: TraineeDecision['actionType'],
    alternativeRationale: string
  ): CounterfactualReplayFork {
    const original: TraineeDecision = this.decisions.find(d => d.id === decisionId) || this.decisions[0] || {
      id: decisionId || 'DEC-DEFAULT',
      timestamp: new Date().toLocaleTimeString(),
      exerciseElapsedSec: this.exerciseTimeSec,
      commanderCallsign: 'SUB_UNIT_CDR',
      actionType: 'ARTILLERY_FIRE_MISSION',
      uncertaintyAtTime: 950,
      rationale: 'Engaged unverified contact during EW barrage jamming',
      confidenceLevel: 4,
      evaluatedEffect: 'FRIENDLY_FIRE_RISK',
      scoreDelta: -30,
      feedback: 'Fratricide risk / phantom engagement under degraded comms.',
      groundTruthDeviationMeters: 450,
    };

    let projectedOutcome = '';
    let projectedScoreDelta = 20;
    let projectedGroundTruthDeviationMeters = 0;
    let ammoSaved = 0;
    let rfExposureAvoidedPct = 0;
    let doctrineVerdict: CounterfactualReplayFork['doctrineVerdict'] = 'OPTIMAL_DOCTRINE';

    if (original.actionType === 'ARTILLERY_FIRE_MISSION') {
      if (alternativeAction === 'CHALLENGE_IFF_KEY' || alternativeAction === 'DISPATCH_RECCE_DRONE') {
        projectedOutcome = 'Counterfactual Branch: Commander delayed kinetic strike by 20s to cross-verify. Cryptographic challenge confirmed contact was an empty cyber phantom. 48 rounds of 155mm ammunition preserved; RF signature avoided counter-battery lock.';
        projectedScoreDelta = 24;
        ammoSaved = 48;
        rfExposureAvoidedPct = 35;
        doctrineVerdict = 'OPTIMAL_DOCTRINE';
      } else if (alternativeAction === 'EMCON_SILENCE_ORDER') {
        projectedOutcome = 'Counterfactual Branch: Sub-unit instituted immediate radio silence. Hostile direction finding lost fix on command post coordinates; incoming rocket salvo fell harmlessly into vacated valley.';
        projectedScoreDelta = 20;
        ammoSaved = 0;
        rfExposureAvoidedPct = 65;
        doctrineVerdict = 'OPTIMAL_DOCTRINE';
      }
    } else if (original.actionType === 'TACTICAL_RETREAT') {
      if (alternativeAction === 'AUTHENTICATE_RADIO_ORDER') {
        projectedOutcome = 'Counterfactual Branch: Commander executed shackle verification on withdrawal directive. Deception was exposed in 15 seconds; defensive perimeter was held intact against enemy mechanized probe.';
        projectedScoreDelta = 35;
        ammoSaved = 0;
        rfExposureAvoidedPct = 0;
        doctrineVerdict = 'FRATRICIDE_AVERTED';
      }
    } else {
      projectedOutcome = `Counterfactual Branch: If ${alternativeAction} were authorized with rationale "${alternativeRationale}", reconnaissance corroboration would have preserved defensive integrity with minimal operational friction.`;
      projectedScoreDelta = 18;
      ammoSaved = 12;
      rfExposureAvoidedPct = 20;
      doctrineVerdict = 'OPTIMAL_DOCTRINE';
    }

    const fork: CounterfactualReplayFork = {
      forkId: `FORK-${Date.now().toString().slice(-4)}`,
      decisionId: original.id,
      forkTimeSec: original.exerciseElapsedSec,
      timeSec: original.exerciseElapsedSec,
      originalDecision: original,
      originalAction: original.actionType,
      actualOutcomeNarrative: original.feedback,
      alternativeAction,
      alternateAction: alternativeAction,
      alternativeRationale,
      projectedOutcome,
      counterfactualNarrative: projectedOutcome,
      projectedScoreDelta,
      scoreDifference: projectedScoreDelta,
      projectedGroundTruthDeviationMeters,
      ammoSaved,
      projectedAmmunitionRoundsSaved: ammoSaved,
      projectedCasualtiesAvoided: doctrineVerdict === 'FRATRICIDE_AVERTED' ? 14 : 0,
      rfExposureAvoidedPct,
      projectedRfSignatureAvoidedPct: rfExposureAvoidedPct,
      doctrineVerdict,
      doctrineTakeaway: doctrineVerdict === 'FRATRICIDE_AVERTED'
        ? 'DSSC Doctrine: Orders countermanding the primary mission must undergo challenge-reply authentication regardless of purported authority.'
        : 'DSSC Doctrine: Prioritizing reconnaissance and emissions hygiene prevents premature tactical escalation under EW degradation.',
      divergencePoints: [
        {
          metricName: '155mm Munitions Expended',
          actualValue: `${ammoSaved > 0 ? ammoSaved : 48} Rounds (Depleted on Decoy)`,
          counterfactualValue: '0 Rounds (Conserved in Battery)',
          impact: 'CRITICAL_SAVINGS',
        },
        {
          metricName: 'RF Transmission Footprint',
          actualValue: '82% Peak (Hostile DF Locked)',
          counterfactualValue: '14% (Stealth Intact)',
          impact: 'TACTICAL_ADVANTAGE',
        },
        {
          metricName: 'Hostile Counter-Battery Threat',
          actualValue: 'Rocket Salvo Inbound on CP',
          counterfactualValue: 'Position Undetected',
          impact: 'CRITICAL_SAVINGS',
        },
        {
          metricName: 'Tactical Outcome',
          actualValue: original.feedback,
          counterfactualValue: projectedOutcome,
          impact: 'TACTICAL_ADVANTAGE',
        },
      ],
    };

    this.eventLog.append('TICK_SNAPSHOT', original.exerciseElapsedSec, {
      type: 'COUNTERFACTUAL_FORK_GENERATED',
      fork,
    });

    return fork;
  }

  /**
   * Applies manual or preset EW Jamming Intensity.
   */
  public applyEWIntensity(intensityKw: number) {
    this.ewJammingIntensity = intensityKw;
    this.commsMetrics = this.degradation.computeCommsMetrics(
      this.commsMetrics,
      intensityKw,
      this.scenario.instructorInjectDefaults.weatherPenalty
    );
    this.eventLog.append('INJECT_APPLIED', this.exerciseTimeSec, {
      type: 'EW_INTENSITY_UPDATE',
      intensityKw,
    }, 'INSTRUCTOR_WHITE_CELL', 'DIRECTING_STAFF');
  }

  /**
   * Applies manual comms overrides.
   */
  public updateCommsMetrics(updates: Partial<CommsMetrics>) {
    this.commsMetrics = { ...this.commsMetrics, ...updates };
    this.eventLog.append('COMMS_OVERRIDE', this.exerciseTimeSec, updates, 'INSTRUCTOR_WHITE_CELL', 'DIRECTING_STAFF');
  }

  /**
   * Injects a cyber ghost radar track.
   */
  public injectGhostTrack(): TacticalUnit {
    const ghost: TacticalUnit = {
      id: `GHOST-${Date.now()}`,
      callsign: 'BOGEY-9 (CYBER PHANTOM)',
      name: 'Spoofed Air Contact',
      domain: 'AIR',
      affiliation: 'UNKNOWN',
      type: 'False Datalink Injection',
      groundTruthPos: { x: 999, y: 0, z: 999, gridRef: 'N/A' },
      perceivedPos: { x: -6, y: 32, z: 14, gridRef: '43X MH 7920 8430' },
      altitude: 7200,
      heading: 180,
      speed: 340,
      status: 'OPTIMAL',
      health: 100,
      ammo: 0,
      commsQuality: 15,
      uncertaintyRadius: 1500,
      lastContactSecondsAgo: 1,
      isGhostContact: true,
      isContradictory: true,
      contradictoryDetail: 'Datalink reports hostile strike fighter, but forward optical spotters report zero aircraft in sector.',
      admiralty: {
        reliability: 'E',
        credibility: 5,
        source: 'Secondary Radar Track (Unverified)',
        ageSec: 1,
      }
    };

    this.units = [ghost, ...this.units];
    this.activeDisruptions.add('Ghost Track Injected');

    this.transmitRadioMessage({
      senderCallsign: 'AIR-DEFENSE-RADAR',
      domain: 'AIR',
      text: 'FLASH: Fast-mover track painted at Grid MH 7920 8430 altitude 7200m. Transponder code invalid. Optical spotters cannot confirm contact.',
      priority: 'FLASH',
    });

    this.eventLog.append('INJECT_APPLIED', this.exerciseTimeSec, {
      type: 'GHOST_DRONE',
      ghostId: ghost.id,
    }, 'INSTRUCTOR_WHITE_CELL', 'DIRECTING_STAFF');

    return ghost;
  }

  /**
   * Injects contradictory intelligence.
   */
  public injectContradictoryIntel() {
    this.units = this.units.map(u => {
      if (u.id === 'OPFOR-ARMOR-COLUMN') {
        return {
          ...u,
          isContradictory: true,
          contradictoryDetail: 'Forward Observation Post reports armor halted in gorge defile, while SAR satellite radar reports vehicles advancing at 30 km/h.'
        };
      }
      return u;
    });

    this.activeDisruptions.add('Contradictory Intel Active');

    this.transmitRadioMessage({
      senderCallsign: 'FORWARD-OBS-ALPHA',
      domain: 'LAND',
      text: 'OBSERVATION POST ALPHA: Hostile armor column halted in gorge defile under camouflage net! Automated datalink is reporting obsolete speed. DO NOT FIRE on blind coordinates.',
      priority: 'PRIORITY',
      isContradictory: true,
    });

    this.eventLog.append('INJECT_APPLIED', this.exerciseTimeSec, {
      type: 'CONTRADICTORY_REPORT',
      unitId: 'OPFOR-ARMOR-COLUMN',
    }, 'INSTRUCTOR_WHITE_CELL', 'DIRECTING_STAFF');
  }

  /**
   * Injects radio dropout on a unit.
   */
  public injectRadioBlackout(unitId: string = 'BLU-CHARLIE') {
    this.units = this.units.map(u => {
      if (u.id === unitId) {
        return {
          ...u,
          status: 'SILENT',
          commsQuality: 5,
          uncertaintyRadius: 1600,
          lastContactSecondsAgo: 240,
        };
      }
      return u;
    });

    this.activeDisruptions.add(`Comms Silent: ${unitId}`);

    this.transmitRadioMessage({
      senderCallsign: 'SIGNALS-NET',
      domain: 'LAND',
      text: `COMMS ALERT: ${unitId} has dropped off VHF Net. Mountain ridgeline repeater node unresponsive.`,
      priority: 'FLASH',
    });

    this.eventLog.append('INJECT_APPLIED', this.exerciseTimeSec, {
      type: 'RADIO_DROPOUT',
      unitId,
    }, 'INSTRUCTOR_WHITE_CELL', 'DIRECTING_STAFF');
  }

  /**
   * Transmits radio chatter through the degradation layer.
   * Transmissions elevate friendly RF signature for enemy DF triangulation!
   */
  public transmitRadioMessage(msg: {
    senderCallsign: string;
    domain: TacticalUnit['domain'];
    text: string;
    priority: RadioMessage['priority'];
    isContradictory?: boolean;
  }): RadioMessage {
    const { corruptedText, audioNoiseRatio } = this.degradation.degradeRadioText(
      msg.text,
      this.commsMetrics
    );

    // EMCON consequence: Radio bursts raise RF emission signature
    this.emconState.rfSignaturePct = Math.min(100, this.emconState.rfSignaturePct + 16);
    this.emconState.totalTransmissionsCount += 1;
    this.emconState.timeInStrictSilenceSec = 0;

    const message: RadioMessage = {
      id: `MSG-${Date.now()}-${this.prng.nextInt(100, 999)}`,
      timestamp: new Date().toLocaleTimeString(),
      senderCallsign: msg.senderCallsign,
      domain: msg.domain,
      text: msg.text,
      corruptedText,
      priority: msg.priority,
      isContradictory: msg.isContradictory,
      audioNoiseRatio,
      admiralty: {
        reliability: 'B',
        credibility: 2,
        source: `VHF Tactical Net (${msg.senderCallsign})`,
        ageSec: 0,
      }
    };

    this.radioChatter = [message, ...this.radioChatter];
    this.eventLog.append('RADIO_TRANSMITTED', this.exerciseTimeSec, message, 'SIGNALS', msg.senderCallsign);

    return message;
  }

  /**
   * Evaluates Trainee Tactical Decision under degraded truth.
   */
  public executeDecision(
    decisionData: Omit<TraineeDecision, 'id' | 'timestamp' | 'exerciseElapsedSec' | 'evaluatedEffect' | 'scoreDelta' | 'feedback' | 'groundTruthDeviationMeters'>,
    actorRoleId: RoleId = 'SUB_UNIT_CDR'
  ): { decision: TraineeDecision; snapshot: TimelineSnapshot } {
    let evaluatedEffect: TraineeDecision['evaluatedEffect'] = 'ACCURATE_STRIKE';
    let scoreDelta = 15;
    let feedback = 'Target successfully engaged. Operational integrity preserved.';
    let groundTruthDeviationMeters = 0;

    const target = this.units.find(u => u.id === decisionData.targetUnitId);

    if (target) {
      const dx = target.perceivedPos.x - target.groundTruthPos.x;
      const dz = target.perceivedPos.z - target.groundTruthPos.z;
      groundTruthDeviationMeters = Math.round(Math.hypot(dx, dz) * 100);
    }

    // Check if decision was preceded by a completed verification action
    const wasPrecededByVerification = this.activeVerifications.some(
      v => v.completed && (v.targetRef === decisionData.targetUnitId || v.targetRef === 'GLOBAL_NET')
    );

    if (decisionData.actionType === 'ARTILLERY_FIRE_MISSION') {
      // Artillery increases RF signature substantially
      this.emconState.rfSignaturePct = Math.min(100, this.emconState.rfSignaturePct + 25);

      if (target?.isGhostContact) {
        evaluatedEffect = 'MISSED_GHOST';
        scoreDelta = -20;
        feedback = 'BLUNDER: Artillery committed to unverified cyber ghost contact. 155mm ammunition depleted on empty coordinates.';
      } else if (target?.affiliation === 'BLUFOR') {
        evaluatedEffect = 'FRIENDLY_FIRE_RISK';
        scoreDelta = -35;
        feedback = 'CRITICAL FAILURE: Artillery targeted friendly unit under degraded position ambiguity! Fratricide averted by safety relay.';
      } else {
        evaluatedEffect = 'ACCURATE_STRIKE';
        scoreDelta = 25;
        feedback = `EFFECTIVE STRIKE: Hostile column suppressed despite ${groundTruthDeviationMeters}m telemetry error!`;
      }
    } else if (decisionData.actionType === 'CHALLENGE_IFF_KEY') {
      evaluatedEffect = 'EFFECTIVE_COUNTERMEASURE';
      scoreDelta = 18;
      feedback = 'DISCIPLINE: Cryptographic challenge revealed phantom radar deception target!';
    } else if (decisionData.actionType === 'DISPATCH_RECCE_DRONE') {
      evaluatedEffect = 'EFFECTIVE_COUNTERMEASURE';
      scoreDelta = 15;
      feedback = 'TACTICAL RECON: Optical feed verified true enemy coordinates before committing heavy weapons.';
    } else if (decisionData.actionType === 'EMCON_SILENCE_ORDER') {
      this.emconState.rfSignaturePct = Math.max(5, this.emconState.rfSignaturePct - 30);
      evaluatedEffect = 'EFFECTIVE_COUNTERMEASURE';
      scoreDelta = 20;
      feedback = 'EMISSION CONTROL: Radios went silent, denying adversary DF triangulation and neutralizing home-on-jam missiles.';
    } else if (decisionData.actionType === 'FREQUENCY_HOP_SHIFT') {
      evaluatedEffect = 'EFFECTIVE_COUNTERMEASURE';
      scoreDelta = 16;
      feedback = 'FHSS HOP: Shifted net to ECCM frequency band, restoring clear voice comms.';
    } else if (decisionData.actionType === 'AUTHENTICATE_RADIO_ORDER') {
      evaluatedEffect = 'EFFECTIVE_COUNTERMEASURE';
      scoreDelta = 20;
      feedback = 'AUTHENTICATION DISCIPLINE: Shackle challenge exposed hostile psychological warfare order!';
    } else if (decisionData.actionType === 'DISPATCH_MOTORCYCLE_RUNNER') {
      evaluatedEffect = 'EFFECTIVE_COUNTERMEASURE';
      scoreDelta = 18;
      feedback = 'COMPENSATION DISCIPLINE: Physical motorcycle runner established jam-proof communications link through mountain shadow.';
    }

    const decision: TraineeDecision = {
      ...decisionData,
      id: `DEC-${Date.now().toString().slice(-5)}`,
      timestamp: new Date().toLocaleTimeString(),
      exerciseElapsedSec: this.exerciseTimeSec,
      evaluatedEffect,
      scoreDelta,
      feedback,
      groundTruthDeviationMeters,
      wasPrecededByVerification,
      rfSignatureAtOrder: this.emconState.rfSignaturePct,
      compensationTimeSpentSec: wasPrecededByVerification ? 20 : 0,
    };

    this.decisions = [decision, ...this.decisions];

    // Capture decision snapshot for AAR Replay
    const snapshot = this.recordSnapshot(
      `Order: ${decisionData.actionType.replace(/_/g, ' ')}`,
      decision
    );

    this.eventLog.append('DECISION_LOGGED', this.exerciseTimeSec, decision, actorRoleId, decisionData.commanderCallsign);

    // Directing staff radio confirmation
    this.transmitRadioMessage({
      senderCallsign: 'WHITE-CELL-DIRECTOR',
      domain: 'LAND',
      text: `DIRECTING STAFF: Order ${decisionData.actionType} logged at T+${this.formatClock(this.exerciseTimeSec)}. Rationale registered in DSSC audit log.`,
      priority: 'PRIORITY',
    });

    return { decision, snapshot };
  }

  /**
   * Records a timeline snapshot for the AAR Scrubber.
   */
  private recordSnapshot(label: string, decision?: TraineeDecision): TimelineSnapshot {
    const snapshot: TimelineSnapshot = {
      timeSec: this.exerciseTimeSec,
      label,
      groundTruthUnits: JSON.parse(JSON.stringify(this.units)),
      perceivedUnits: JSON.parse(JSON.stringify(this.getUnitsForRole('SUB_UNIT_CDR'))),
      decision,
      ewJammingKw: this.ewJammingIntensity,
      snr: this.commsMetrics.snr,
      latencySec: this.commsMetrics.latencyMs / 1000,
      packetLoss: this.commsMetrics.packetLoss,
      activeDisruptions: Array.from(this.activeDisruptions),
      emconState: { ...this.emconState },
      pendingSpoofedOrder: this.pendingSpoofedOrder ? { ...this.pendingSpoofedOrder } : undefined,
    };

    this.timelineSnapshots.push(snapshot);
    this.eventLog.append('TICK_SNAPSHOT', this.exerciseTimeSec, snapshot);

    return snapshot;
  }

  private formatClock(totalSec: number): string {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
