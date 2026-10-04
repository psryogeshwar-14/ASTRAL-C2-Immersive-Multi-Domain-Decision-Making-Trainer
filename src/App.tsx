import { useState, useEffect } from 'react';
import type { 
  TacticalUnit, 
  CommsMetrics, 
  RadioMessage, 
  TraineeDecision, 
  ScenarioDefinition, 
  TraineeRole,
  TimelineSnapshot,
  EMCONState,
  VerificationAction,
  SpoofedRadioOrder 
} from './types/tactical';
import { 
  SCENARIOS, 
  TRAINEE_ROLES, 
  getInitialUnits, 
  getInitialCommsMetrics, 
  getScriptedRadioChatter 
} from './services/scenarioEngine';
import { audioEngine } from './services/audioEngine';
import { Sandtable3D } from './components/Sandtable3D';
import { TacticalCOP } from './components/TacticalCOP';
import { InstructorDashboard } from './components/InstructorDashboard';
import { RoleSwitcher } from './components/RoleSwitcher';
import { AARModal } from './components/AARModal';
import { 
  Shield, 
  Play, 
  Pause, 
  Award, 
  HelpCircle, 
  Flame,
  Wifi,
  WifiOff,
  Maximize2,
  Minimize2,
  Columns,
  Square,
  Sliders,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';
import { networkClient } from './services/networkClient.ts';
import type { RoleId } from '../server/types.ts';

export function App() {
  // Scenario state
  const [currentScenario, setCurrentScenario] = useState<ScenarioDefinition>(SCENARIOS[0]);
  const [exerciseTimeSec, setExerciseTimeSec] = useState<number>(0);
  const [isSimPaused, setIsSimPaused] = useState<boolean>(false);

  // Role & Perspective state
  const [activeRole, setActiveRole] = useState<TraineeRole>(TRAINEE_ROLES[0]);
  const [showGroundTruth, setShowGroundTruth] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'ORBIT' | 'TOP_DOWN' | 'BUNKER' | 'FOLLOW'>('ORBIT');

  // Screen friendly & Viewport responsive state
  const [layoutMode, setLayoutMode] = useState<'STANDARD' | 'THEATER' | 'SPLIT'>('STANDARD');
  const [uiDensity, setUiDensity] = useState<'COMPACT' | 'STANDARD'>('STANDARD');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'MAP' | 'CONSOLE'>('MAP');

  // Multi-domain simulation state
  const [units, setUnits] = useState<TacticalUnit[]>(getInitialUnits());
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>('OPFOR-ARMOR-COLUMN');
  const [commsMetrics, setCommsMetrics] = useState<CommsMetrics>(getInitialCommsMetrics());
  const [ewJammingIntensity, setEwJammingIntensity] = useState<number>(45);
  const [radioChatter, setRadioChatter] = useState<RadioMessage[]>(getScriptedRadioChatter());
  const [decisions, setDecisions] = useState<TraineeDecision[]>([]);

  // Periodic timeline snapshots for the AAR Scrubber
  const [timelineSnapshots, setTimelineSnapshots] = useState<TimelineSnapshot[]>([
    {
      timeSec: 0,
      label: 'Scenario Initiation (T+00:00)',
      groundTruthUnits: getInitialUnits(),
      perceivedUnits: getInitialUnits(),
      ewJammingKw: 45,
      snr: 12.5,
      latencySec: 7.4,
      packetLoss: 28,
      activeDisruptions: ['EW Jammer Active'],
    }
  ]);

  // MUST FEATURE 1: Deception & Spoofed Orders
  const [pendingSpoofedOrder, setPendingSpoofedOrder] = useState<SpoofedRadioOrder | undefined>(undefined);

  // MUST FEATURE 2: Compensation / Verification Pipelines
  const [activeVerifications, setActiveVerifications] = useState<VerificationAction[]>([]);

  // MUST FEATURE 3: EMCON Emission-Control & Hostile DF Threat Physics
  const [emconState, setEmconState] = useState<EMCONState>({
    rfSignaturePct: 18,
    adversaryDFLockPct: 0,
    totalTransmissionsCount: 0,
    timeInStrictSilenceSec: 0,
    counterBatteryThreatLevel: 'LOW',
  });

  // Ballistic mission visualization
  const [ballisticMission, setBallisticMission] = useState<{
    active: boolean;
    startPos?: TacticalUnit['groundTruthPos'];
    targetPos?: TacticalUnit['groundTruthPos'];
  } | null>(null);

  // AAR Modal & Briefing Modal State
  const [isAAROpen, setIsAAROpen] = useState<boolean>(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState<boolean>(false);

  // Real-Time LAN WebSocket Multiplayer state
  const [isNetConnected, setIsNetConnected] = useState<boolean>(false);
  const [networkPeers, setNetworkPeers] = useState<{ id: string; roleId: RoleId; callsign: string }[]>([]);
  const [activeRoomId] = useState<string>('ROOM_ALPHA');
  const selectedUnit = units.find(u => u.id === selectedUnitId) || null;

  // NETWORK SYNC LIFECYCLE
  useEffect(() => {
    networkClient.connect(activeRoomId, activeRole.id as RoleId, activeRole.title, {
      onConnected: (_roomId, peers) => {
        setIsNetConnected(true);
        setNetworkPeers(peers);
      },
      onDisconnected: () => {
        setIsNetConnected(false);
      },
      onTickUpdate: (timeSec, serverUnits, serverComms, _activeDisruptions, serverEmcon, serverVerifications, serverSpoofed) => {
        setExerciseTimeSec(timeSec);
        setUnits(serverUnits);
        setCommsMetrics(serverComms);
        if (serverEmcon) setEmconState(serverEmcon);
        if (serverVerifications) setActiveVerifications(serverVerifications);
        if (serverSpoofed) setPendingSpoofedOrder(serverSpoofed);
      },
      onDecisionLogged: (decision, snapshot) => {
        setDecisions((prev) => [decision, ...prev.filter(d => d.id !== decision.id)]);
        setTimelineSnapshots((prev) => [...prev, snapshot]);
      },
      onRadioBroadcast: (message) => {
        setRadioChatter((prev) => [message, ...prev.filter(m => m.id !== message.id)]);
        audioEngine.playRadioMessageBurst(0.25);
      },
      onInjectTriggered: () => {
        audioEngine.playAlertKlaxon();
      },
      onVerificationUpdate: (verification) => {
        setActiveVerifications(prev => [verification, ...prev.filter(v => v.id !== verification.id)]);
      },
      onSpoofedOrderInjected: (order) => {
        setPendingSpoofedOrder(order);
        audioEngine.playAlertKlaxon();
      },
      onPeerChange: (peers) => {
        setNetworkPeers(peers);
      },
    });

    return () => {
      networkClient.disconnect();
    };
  }, [activeRoomId, activeRole.id, activeRole.title]);

  // LOCAL SIMULATION CLOCK & PHYSICS TICK LOOP (runs as fallback when offline)
  useEffect(() => {
    if (isSimPaused || isNetConnected) return;

    const interval = setInterval(() => {
      setExerciseTimeSec((prev) => {
        const nextTime = prev + 1;

        // Take snapshot every 15 seconds for replay
        if (nextTime % 15 === 0) {
          setTimelineSnapshots((prevSnaps) => [
            ...prevSnaps,
            {
              timeSec: nextTime,
              label: `Status Update (T+${Math.floor(nextTime / 60)}:${(nextTime % 60).toString().padStart(2, '0')})`,
              groundTruthUnits: JSON.parse(JSON.stringify(units)),
              perceivedUnits: JSON.parse(JSON.stringify(units)),
              ewJammingKw: ewJammingIntensity,
              snr: commsMetrics.snr,
              latencySec: commsMetrics.latencyMs / 1000,
              packetLoss: commsMetrics.packetLoss,
              activeDisruptions: [
                ewJammingIntensity > 60 ? 'Barrage Jamming' : 'Spot Jamming',
                commsMetrics.latencyMs > 10000 ? 'High Latency Lag' : 'Nominal Latency',
              ],
            }
          ]);
        }

        return nextTime;
      });

      setUnits((prevUnits) => {
        return prevUnits.map((u) => {
          if (u.id === 'OPFOR-ARMOR-COLUMN') {
            const newX = u.groundTruthPos.x - 0.08;
            const newZ = u.groundTruthPos.z + 0.04;
            const latencyDelayRatio = Math.max(0.1, 1 - (commsMetrics.latencyMs / 40000));

            return {
              ...u,
              groundTruthPos: {
                ...u.groundTruthPos,
                x: newX,
                z: newZ,
              },
              perceivedPos: {
                ...u.perceivedPos,
                x: u.perceivedPos.x - 0.08 * latencyDelayRatio,
                z: u.perceivedPos.z + 0.04 * latencyDelayRatio,
              },
              uncertaintyRadius: Math.min(1800, u.uncertaintyRadius + (commsMetrics.packetLoss > 30 ? 4 : 1)),
              lastContactSecondsAgo: u.lastContactSecondsAgo + 1,
            };
          }

          if (u.id === 'OPFOR-LOITERING-SWARM') {
            const angle = Date.now() * 0.001;
            const newX = 12 + Math.cos(angle) * 8;
            const newZ = 5 + Math.sin(angle) * 8;
            return {
              ...u,
              groundTruthPos: { ...u.groundTruthPos, x: newX, z: newZ },
              perceivedPos: { ...u.perceivedPos, x: newX, z: newZ },
            };
          }

          return {
            ...u,
            lastContactSecondsAgo: u.lastContactSecondsAgo + 1,
          };
        });
      });

      // MUST FEATURE 2: Local Verification Action countdown ticks
      setActiveVerifications((prev) => {
        return prev.map((v) => {
          if (v.status !== 'IN_PROGRESS') return v;
          const rem = Math.max(0, v.remainingSec - 1);
          if (rem === 0 && v.status === 'IN_PROGRESS') {
            // Completed! Resolve target uncertainty
            setUnits((unitsPrev) => unitsPrev.map((u) => {
              if (u.id === v.targetRef) {
                return {
                  ...u,
                  uncertaintyRadius: Math.min(u.uncertaintyRadius, 50),
                  lastContactSecondsAgo: 0,
                  isContradictory: false,
                  admiralty: {
                    reliability: 'A',
                    credibility: 1,
                    source: v.type === 'DISPATCH_PHYSICAL_RUNNER' ? 'Runner Ground Fix' : 'Optical UAV 1080p Gimbal',
                    ageSec: 0,
                  }
                };
              }
              return u;
            }));

            // Intersperse radio feedback
            setRadioChatter((rPrev) => [
              {
                id: `MSG-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString(),
                senderCallsign: v.type === 'DISPATCH_PHYSICAL_RUNNER' ? 'RUNNER-SCOUT' : 'RECCE-GIMBAL',
                domain: 'LAND',
                text: `VERIFICATION REPORT: Ground truth confirmed for target. Uncertainty reduced to +/-50m.`,
                priority: 'PRIORITY',
                audioNoiseRatio: 0.1,
              },
              ...rPrev
            ]);

            return { ...v, remainingSec: 0, status: 'COMPLETED' };
          }
          return { ...v, remainingSec: rem };
        });
      });

      // MUST FEATURE 3: Local EMCON Physics Tick
      setEmconState((prev) => {
        const isSilence = commsMetrics.emconLevel === 3;
        let rf = prev.rfSignaturePct;
        let df = prev.adversaryDFLockPct;
        let silenceTime = prev.timeInStrictSilenceSec;

        if (isSilence) {
          rf = Math.max(5, rf - 2);
          df = Math.max(0, df - 2);
          silenceTime += 1;
        } else {
          if (rf > 18) rf = Math.max(18, rf - 1);
          if (rf > 70) {
            df = Math.min(100, df + 3);
          } else if (df > 0) {
            df = Math.max(0, df - 1);
          }
        }

        let threatLevel: EMCONState['counterBatteryThreatLevel'] = 'LOW';
        if (df >= 80) {
          threatLevel = 'CRITICAL_LOCK_IMMINENT';
        } else if (df >= 35) {
          threatLevel = 'ELEVATED';
        }

        return {
          ...prev,
          rfSignaturePct: rf,
          adversaryDFLockPct: df,
          timeInStrictSilenceSec: silenceTime,
          counterBatteryThreatLevel: threatLevel,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimPaused, isNetConnected, commsMetrics.latencyMs, commsMetrics.packetLoss, commsMetrics.emconLevel, units, ewJammingIntensity, commsMetrics.snr]);

  // MUST FEATURE 2: START VERIFICATION HANDLER
  const handleStartVerification = (
    actionType: VerificationAction['type'],
    targetRef: string,
    label: string,
    durationSec: number
  ) => {
    if (isNetConnected) {
      networkClient.startVerification(actionType, targetRef, label, durationSec);
    }

    const newVerif: VerificationAction = {
      id: `VERIF-${Date.now().toString().slice(-4)}`,
      type: actionType,
      targetRef,
      label,
      durationSec,
      remainingSec: durationSec,
      completed: false,
      status: 'IN_PROGRESS',
      commencedAtSec: exerciseTimeSec,
    };

    setActiveVerifications((prev) => [...prev, newVerif]);

    if (actionType !== 'DISPATCH_PHYSICAL_RUNNER') {
      setEmconState((prev) => ({
        ...prev,
        rfSignaturePct: Math.min(100, prev.rfSignaturePct + 6),
        totalTransmissionsCount: prev.totalTransmissionsCount + 1,
      }));
    }
  };

  // MUST FEATURE 1: RESPOND TO SPOOFED ORDER HANDLER
  const handleRespondSpoofedOrder = (
    orderId: string,
    action: 'AUTHENTICATE' | 'REJECT_AS_DECEPTION' | 'BLINDLY_OBEY'
  ) => {
    if (isNetConnected) {
      networkClient.respondSpoofedOrder(orderId, action);
    }

    setPendingSpoofedOrder(undefined);

    if (action === 'AUTHENTICATE') {
      const newDecision: TraineeDecision = {
        id: `DEC-${Date.now().toString().slice(-5)}`,
        commanderCallsign: activeRole.title,
        actionType: 'AUTHENTICATE_RADIO_ORDER',
        uncertaintyAtTime: 1200,
        rationale: 'Challenged retreat directive with rolling Shackle authenticator. Parity check failed; confirmed OPFOR voice deception.',
        confidenceLevel: 5,
        timestamp: new Date().toLocaleTimeString(),
        exerciseElapsedSec: exerciseTimeSec,
        evaluatedEffect: 'EFFECTIVE_COUNTERMEASURE',
        scoreDelta: 30,
        feedback: 'DECEPTION DEFEATED: Shackle challenge exposed hostile deepfake voice directive. Defensive perimeter held.',
        groundTruthDeviationMeters: 0,
      };
      setDecisions((prev) => [newDecision, ...prev]);

      setRadioChatter((prev) => [
        {
          id: `MSG-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          senderCallsign: 'SIGNALS-NET',
          domain: 'LAND',
          text: 'SHACKLE CHALLENGE RESULT: Authenticity code rejected! Transmission was hostile deepfake voice synthesis. Stand fast at Point 5140!',
          priority: 'FLASH',
          audioNoiseRatio: 0.1,
        },
        ...prev
      ]);
    } else if (action === 'REJECT_AS_DECEPTION') {
      const newDecision: TraineeDecision = {
        id: `DEC-${Date.now().toString().slice(-5)}`,
        commanderCallsign: activeRole.title,
        actionType: 'HOLD_FIRE_VERIFY',
        uncertaintyAtTime: 1000,
        rationale: 'Rejected retreat order outright based on operational inconsistency with primary defensive mission.',
        confidenceLevel: 4,
        timestamp: new Date().toLocaleTimeString(),
        exerciseElapsedSec: exerciseTimeSec,
        evaluatedEffect: 'EFFECTIVE_COUNTERMEASURE',
        scoreDelta: 25,
        feedback: 'DOCTRINAL RESOLVE: Rejected fraudulent retreat directive. Maintained tactical initiative.',
        groundTruthDeviationMeters: 0,
      };
      setDecisions((prev) => [newDecision, ...prev]);
    } else if (action === 'BLINDLY_OBEY') {
      const newDecision: TraineeDecision = {
        id: `DEC-${Date.now().toString().slice(-5)}`,
        commanderCallsign: activeRole.title,
        actionType: 'TACTICAL_RETREAT',
        uncertaintyAtTime: 1800,
        rationale: 'Complied with unauthenticated retreat order broadcast over compromised net.',
        confidenceLevel: 3,
        timestamp: new Date().toLocaleTimeString(),
        exerciseElapsedSec: exerciseTimeSec,
        evaluatedEffect: 'FRIENDLY_FIRE_RISK',
        scoreDelta: -40,
        feedback: 'CRITICAL FAILURE: Subunit abandoned Point 5140 due to unverified OPFOR voice spoof! Key terrain lost.',
        groundTruthDeviationMeters: 2500,
      };
      setDecisions((prev) => [newDecision, ...prev]);
    }
  };

  // HANDLE TRAINEE DECISION EXECUTION
  const handleExecuteDecision = (decisionData: Omit<TraineeDecision, 'id' | 'timestamp' | 'exerciseElapsedSec' | 'evaluatedEffect' | 'scoreDelta' | 'feedback' | 'groundTruthDeviationMeters'>) => {
    let evaluatedEffect: TraineeDecision['evaluatedEffect'] = 'ACCURATE_STRIKE';
    let scoreDelta = 15;
    let feedback = 'Target successfully engaged. Operational integrity preserved.';
    let groundTruthDeviationMeters = 0;

    const target = units.find(u => u.id === decisionData.targetUnitId);

    if (target) {
      const dx = target.perceivedPos.x - target.groundTruthPos.x;
      const dz = target.perceivedPos.z - target.groundTruthPos.z;
      groundTruthDeviationMeters = Math.round(Math.hypot(dx, dz) * 100);
    }

    if (isNetConnected) {
      networkClient.sendDecision(decisionData);
    }

    // Firing weapons or calling missions elevates RF footprint
    setEmconState((prev) => ({
      ...prev,
      rfSignaturePct: Math.min(100, prev.rfSignaturePct + 20),
      totalTransmissionsCount: prev.totalTransmissionsCount + 1,
    }));

    if (decisionData.actionType === 'ARTILLERY_FIRE_MISSION') {
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
        feedback = 'EFFECTIVE STRIKE: Hostile column suppressed despite 12s telemetry latency!';
      }

      const artilleryBattery = units.find(u => u.id === 'BLU-ARTILLERY');
      setBallisticMission({
        active: true,
        startPos: artilleryBattery?.groundTruthPos,
        targetPos: target?.groundTruthPos || decisionData.targetPos,
      });

      setTimeout(() => {
        setBallisticMission(null);
      }, 6000);
    } else if (decisionData.actionType === 'CHALLENGE_IFF_KEY') {
      evaluatedEffect = 'EFFECTIVE_COUNTERMEASURE';
      scoreDelta = 18;
      feedback = 'DISCIPLINE: Cryptographic challenge revealed phantom radar deception target!';
    } else if (decisionData.actionType === 'DISPATCH_RECCE_DRONE') {
      evaluatedEffect = 'EFFECTIVE_COUNTERMEASURE';
      scoreDelta = 15;
      feedback = 'TACTICAL RECON: Optical feed verified true enemy coordinates before committing heavy weapons.';
    }

    const newDecision: TraineeDecision = {
      ...decisionData,
      id: `DEC-${Date.now().toString().slice(-5)}`,
      timestamp: new Date().toLocaleTimeString(),
      exerciseElapsedSec: exerciseTimeSec,
      evaluatedEffect,
      scoreDelta,
      feedback,
      groundTruthDeviationMeters,
    };

    setDecisions((prev) => [newDecision, ...prev]);

    // Record decision snapshot for AAR replay scrubber
    setTimelineSnapshots((prev) => [
      ...prev,
      {
        timeSec: exerciseTimeSec,
        label: `Order: ${decisionData.actionType.replace(/_/g, ' ')}`,
        groundTruthUnits: JSON.parse(JSON.stringify(units)),
        perceivedUnits: JSON.parse(JSON.stringify(units)),
        decision: newDecision,
        ewJammingKw: ewJammingIntensity,
        snr: commsMetrics.snr,
        latencySec: commsMetrics.latencyMs / 1000,
        packetLoss: commsMetrics.packetLoss,
        activeDisruptions: [
          ewJammingIntensity > 60 ? 'Barrage Jamming' : 'Spot Jamming',
          'Tactical Fire Mission Committed',
        ],
      }
    ]);

    const radioFeedback: RadioMessage = {
      id: `MSG-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      senderCallsign: 'BATTERY-FIRE-CONTROL',
      domain: 'LAND',
      text: `DIRECTING STAFF ACKNOWLEDGE: Order ${decisionData.actionType} recorded. Rationale registered in DSSC debriefing buffer.`,
      priority: 'PRIORITY',
      audioNoiseRatio: 0.15,
    };
    setRadioChatter((prev) => [radioFeedback, ...prev]);
  };

  // HANDLE INSTANT INSTRUCTOR DISRUPTIONS & PRESETS
  const handleInjectEvent = (type: 'GHOST_DRONE' | 'RADIO_DROPOUT' | 'CONTRADICTORY_FEED' | 'IONO_BLIZZARD' | 'EW_BARRAGE_PRESET' | 'GPS_SPOOF_PRESET' | 'VALLEY_BLACKOUT_PRESET' | 'SPOOFED_RETREAT_ORDER') => {
    if (isNetConnected) {
      networkClient.injectDisruption(type);
    }

    if (type === 'GHOST_DRONE' || type === 'GPS_SPOOF_PRESET') {
      const ghost: TacticalUnit = {
        id: `GHOST-${Date.now()}`,
        callsign: 'BOGEY-9 (CYBER PHANTOM)',
        name: 'Spoofed Air Contact',
        domain: 'AIR',
        affiliation: 'UNKNOWN',
        type: 'False Datalink Injection',
        groundTruthPos: { x: 999, y: 0, z: 999, gridRef: 'N/A' },
        perceivedPos: { x: -5, y: 32, z: 15, gridRef: '43X MH 7920 8430' },
        altitude: 7200,
        heading: 180,
        speed: 340,
        status: 'OPTIMAL',
        health: 100,
        ammo: 0,
        commsQuality: 15,
        uncertaintyRadius: 1500,
        lastContactSecondsAgo: 2,
        isGhostContact: true,
        isContradictory: true,
        contradictoryDetail: 'Datalink reports hostile strike fighter, but forward optical spotters report zero aircraft in sector.',
        admiralty: {
          reliability: 'E',
          credibility: 5,
          source: 'Secondary Radar Track (Unverified)',
          ageSec: 2,
        }
      };
      setUnits((prev) => [ghost, ...prev]);

      setRadioChatter((prev) => [
        {
          id: `MSG-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          senderCallsign: 'RADAR-CONTROL',
          domain: 'AIR',
          text: 'FLASH: High-speed bogey painted at Grid MH 7920 8430. Transponder code invalid. Verify immediately!',
          corruptedText: 'FLASH: High-sp..d bogey painted at Gr#d MH 7920... Transponder in..lid!',
          priority: 'FLASH',
          audioNoiseRatio: 0.35,
        },
        ...prev
      ]);
    } else if (type === 'RADIO_DROPOUT' || type === 'VALLEY_BLACKOUT_PRESET') {
      setUnits((prev) => prev.map((u) => {
        if (u.id === 'BLU-CHARLIE') {
          return {
            ...u,
            status: 'SILENT',
            commsQuality: 5,
            uncertaintyRadius: 1400,
            lastContactSecondsAgo: 180,
          };
        }
        return u;
      }));

      setRadioChatter((prev) => [
        {
          id: `MSG-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          senderCallsign: 'SIGNALS-NET',
          domain: 'LAND',
          text: 'RADIO CARRIER LOST: Charlie-6 has dropped off VHF Net. Mountain ridgeline repeater node unresponsive.',
          priority: 'FLASH',
          audioNoiseRatio: 0.8,
        },
        ...prev
      ]);
    } else if (type === 'CONTRADICTORY_FEED') {
      setUnits((prev) => prev.map((u) => {
        if (u.id === 'OPFOR-ARMOR-COLUMN') {
          return {
            ...u,
            isContradictory: true,
            contradictoryDetail: 'Forward Observation Post reports armor halted in gorge, while SAR satellite radar reports vehicles advancing at 30 km/h.'
          };
        }
        return u;
      }));

      setRadioChatter((prev) => [
        {
          id: `MSG-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          senderCallsign: 'FORWARD-OBSERVER-ALPHA',
          domain: 'LAND',
          text: 'OBSERVATION POST: Enemy armor column is stationary under camouflaged defile. Do NOT fire on old grid coordinates!',
          corruptedText: 'OBSERVATION POST: Enemy armor col..mn is statio..ry... Do NOT fire on old grid...!',
          priority: 'PRIORITY',
          isContradictory: true,
          audioNoiseRatio: 0.45,
        },
        ...prev
      ]);
    } else if (type === 'IONO_BLIZZARD' || type === 'EW_BARRAGE_PRESET') {
      setRadioChatter((prev) => [
        {
          id: `MSG-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          senderCallsign: 'SAMYUKTA-7',
          domain: 'EW',
          text: 'EMERGENCY: High-density broadband noise flooding VHF Channels 1 through 8. Switch to FHSS immediately!',
          priority: 'FLASH',
          audioNoiseRatio: 0.7,
        },
        ...prev
      ]);
    } else if (type === 'SPOOFED_RETREAT_ORDER') {
      const spoofed: SpoofedRadioOrder = {
        id: `SPOOF-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        senderCallsign: 'BRIGADE-COMMAND-NET',
        purportedRank: 'Brigadier G.S.',
        orderText: 'ALL UNITS IN SECTOR: ADVERSARY MECHANIZED BREAKTHROUGH CONFIRMED AT TRISHUL PASS. IMMEDIATE TACTICAL WITHDRAWAL ORDERED TO PHASE LINE BLUE (GRID 42W LK 9180). ABANDON FORWARD OBSERVATION REDOUBTS.',
        claimedAction: 'FALL_BACK_IMMEDIATELY',
        authenticationCode: 'SHACKLE: BRAVO-7',
        expectedValidCode: 'SHACKLE: FOXTROT-4',
        isValidAuth: false,
        isDeception: true,
        status: 'PENDING',
        flawHint: 'Transmitted with non-matching hourly Shackle table and unfamiliar cadence.',
      };
      setPendingSpoofedOrder(spoofed);
      audioEngine.playAlertKlaxon();

      setRadioChatter((prev) => [
        {
          id: `MSG-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          senderCallsign: 'BRIGADE-HQ-ALPHA',
          domain: 'LAND',
          text: 'FLASH DIRECTIVE: IMMEDIATE RETREAT FROM POINT 5140 ORDERED. FALL BACK TO SECONDARY DEFENSE GRID 42W LK 9180.',
          priority: 'FLASH',
          audioNoiseRatio: 0.2,
        },
        ...prev
      ]);
    }
  };

  // RESET EXERCISE
  const handleResetExercise = () => {
    setUnits(getInitialUnits());
    setCommsMetrics(getInitialCommsMetrics());
    setEwJammingIntensity(currentScenario.instructorInjectDefaults.ewJammerPowerKw);
    setDecisions([]);
    setExerciseTimeSec(0);
    setRadioChatter(getScriptedRadioChatter());
    setTimelineSnapshots([
      {
        timeSec: 0,
        label: 'Scenario Reset (T+00:00)',
        groundTruthUnits: getInitialUnits(),
        perceivedUnits: getInitialUnits(),
        ewJammingKw: currentScenario.instructorInjectDefaults.ewJammerPowerKw,
        snr: 12.5,
        latencySec: 7.4,
        packetLoss: 28,
        activeDisruptions: ['Reset Initial State'],
      }
    ]);
    audioEngine.playFreqHopChirp();
  };

  // SWITCH SCENARIO
  const handleScenarioChange = (scen: ScenarioDefinition) => {
    setCurrentScenario(scen);
    setUnits(getInitialUnits());
    setCommsMetrics({
      ...getInitialCommsMetrics(),
      packetLoss: scen.instructorInjectDefaults.packetLossPct,
      latencyMs: scen.instructorInjectDefaults.latencySec * 1000,
    });
    setEwJammingIntensity(scen.instructorInjectDefaults.ewJammerPowerKw);
    setDecisions([]);
    setExerciseTimeSec(0);
  };

  const formatClock = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // FULLSCREEN HANDLER
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // HOTKEYS FOR SCREEN-FRIENDLY & PROJECTOR WORKFLOWS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing into an input, textarea, or select
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setLayoutMode((prev) => (prev === 'THEATER' ? 'STANDARD' : 'THEATER'));
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setUiDensity((prev) => (prev === 'COMPACT' ? 'STANDARD' : 'COMPACT'));
      } else if (e.key === '1') {
        setLayoutMode('STANDARD');
      } else if (e.key === '2') {
        setLayoutMode('SPLIT');
      } else if (e.key === '3') {
        setLayoutMode('THEATER');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div 
      className={`app-root ${uiDensity === 'COMPACT' ? 'density-compact' : ''}`}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#030811',
        overflow: 'hidden',
      }}
    >
      {/* MILITARY C2 TOP COMMAND BAR */}
      <header className="app-c2-header" style={{
        height: '56px',
        background: 'rgba(4, 14, 24, 0.98)',
        borderBottom: '1px solid rgba(0, 229, 255, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
        boxShadow: '0 2px 20px rgba(0, 229, 255, 0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #00e5ff, #00838f)',
            width: '34px',
            height: '34px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(0, 229, 255, 0.5)',
          }}>
            <Shield size={20} color="#040d1a" />
          </div>

          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 800,
                fontSize: '18px',
                letterSpacing: '1.5px',
                color: '#fff',
              }}>
                ASTRAL-C2
              </span>
              <span style={{
                background: 'rgba(0, 229, 255, 0.2)',
                border: '1px solid #00e5ff',
                color: '#00e5ff',
                fontSize: '9px',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: '3px',
                letterSpacing: '1px',
              }}>
                DSSC / MoD
              </span>

              {/* LAN MULTIPLAYER STATUS BADGE */}
              <div 
                title={isNetConnected ? `Connected to WebSocket room ${activeRoomId} with ${networkPeers.length} peer terminal(s)` : 'Operating in Standalone Local Simulation Mode'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: isNetConnected ? 'rgba(0, 255, 102, 0.15)' : 'rgba(0, 229, 255, 0.1)',
                  border: `1px solid ${isNetConnected ? '#00ff66' : 'rgba(0, 229, 255, 0.3)'}`,
                  borderRadius: '3px',
                  padding: '1px 6px',
                  fontSize: '9px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 700,
                  color: isNetConnected ? '#69f0ae' : '#80deea',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (!isNetConnected) {
                    networkClient.connect(activeRoomId, activeRole.id as RoleId, activeRole.title, {});
                  }
                }}
              >
                {isNetConnected ? (
                  <>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff66', boxShadow: '0 0 6px #00ff66' }} />
                    <Wifi size={10} color="#00ff66" />
                    <span>LAN WS: {activeRoomId}</span>
                    <span style={{ color: '#b0bec5' }}>({networkPeers.length + 1} NODES)</span>
                  </>
                ) : (
                  <>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e5ff' }} />
                    <WifiOff size={10} color="#80deea" />
                    <span>LOCAL SIM</span>
                  </>
                )}
              </div>
            </div>
            <div style={{ fontSize: '10px', color: '#80deea', letterSpacing: '0.5px' }}>
              Multi-Domain Decision-Making Trainer for Degraded Communication Environments
            </div>
          </div>
        </div>

        {/* CENTER: SCENARIO SELECTOR & EXERCISE CLOCK */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#90a4ae', fontWeight: 600 }}>SCENARIO:</span>
            <select
              value={currentScenario.id}
              onChange={(e) => {
                const scen = SCENARIOS.find(s => s.id === e.target.value);
                if (scen) handleScenarioChange(scen);
              }}
              style={{
                background: 'rgba(10, 25, 40, 0.85)',
                border: '1px solid rgba(0, 229, 255, 0.35)',
                borderRadius: '4px',
                color: '#e0f7fa',
                padding: '4px 8px',
                fontSize: '11px',
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(5, 15, 25, 0.85)',
            border: '1px solid rgba(0, 229, 255, 0.25)',
            borderRadius: '4px',
            padding: '3px 10px',
          }}>
            <span style={{ fontSize: '10px', color: '#80deea', fontWeight: 700 }}>T-CLOCK:</span>
            <span style={{
              fontSize: '15px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              color: '#00e5ff',
            }}>
              {formatClock(exerciseTimeSec)}
            </span>

            <button
              onClick={() => setIsSimPaused(!isSimPaused)}
              title={isSimPaused ? 'Resume Simulation' : 'Pause Simulation'}
              style={{
                background: 'transparent',
                border: 'none',
                color: isSimPaused ? '#00ff66' : '#ffb700',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {isSimPaused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          </div>

          <div style={{
            background: 'rgba(255, 51, 68, 0.2)',
            border: '1px solid #ff3344',
            color: '#ff8a80',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}>
            <Flame size={12} color="#ff3344" />
            <span>{currentScenario.threatLevel}</span>
          </div>
        </div>

        {/* RIGHT: MULTIPLAYER ROLE SWITCHER & AAR BUTTON */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <RoleSwitcher
            currentRole={activeRole}
            onSelectRole={(role) => {
              setActiveRole(role);
              networkClient.switchRole(role.id as RoleId, role.title);
              if (role.id === 'INSTRUCTOR_WHITE_CELL') {
                setShowGroundTruth(true);
              } else {
                setShowGroundTruth(false);
              }
            }}
          />

          {/* SCREEN-FRIENDLY VIEWPORT CONTROLS */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(10, 25, 40, 0.85)',
            border: '1px solid rgba(0, 229, 255, 0.3)',
            borderRadius: '4px',
            padding: '2px',
            gap: '2px',
          }}>
            <button
              onClick={() => setLayoutMode('STANDARD')}
              title="Standard View (70/30) - Hotkey: 1"
              style={{
                background: layoutMode === 'STANDARD' ? 'rgba(0, 229, 255, 0.25)' : 'transparent',
                border: 'none',
                color: layoutMode === 'STANDARD' ? '#00e5ff' : '#90a4ae',
                borderRadius: '3px',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Columns size={13} />
            </button>
            <button
              onClick={() => setLayoutMode('SPLIT')}
              title="Split View (50/50) - Hotkey: 2"
              style={{
                background: layoutMode === 'SPLIT' ? 'rgba(0, 229, 255, 0.25)' : 'transparent',
                border: 'none',
                color: layoutMode === 'SPLIT' ? '#00e5ff' : '#90a4ae',
                borderRadius: '3px',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Square size={13} />
            </button>
            <button
              onClick={() => setLayoutMode('THEATER')}
              title="Theater / Full Sandtable Briefing Mode - Hotkey: 3 or T"
              style={{
                background: layoutMode === 'THEATER' ? 'rgba(0, 229, 255, 0.25)' : 'transparent',
                border: 'none',
                color: layoutMode === 'THEATER' ? '#00e5ff' : '#90a4ae',
                borderRadius: '3px',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <PanelRightClose size={13} />
            </button>
          </div>

          {/* DENSITY TOGGLE (Compact for laptops/projectors <=900px, Standard for 4K/2K) */}
          <button
            onClick={() => setUiDensity(prev => prev === 'COMPACT' ? 'STANDARD' : 'COMPACT')}
            title={`Toggle UI Density (Hotkey: D) - Current: ${uiDensity}`}
            style={{
              background: uiDensity === 'COMPACT' ? 'rgba(0, 229, 255, 0.25)' : 'rgba(10, 25, 40, 0.8)',
              border: `1px solid ${uiDensity === 'COMPACT' ? '#00e5ff' : 'rgba(0, 229, 255, 0.3)'}`,
              color: uiDensity === 'COMPACT' ? '#00e5ff' : '#80deea',
              borderRadius: '4px',
              padding: '5px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <Sliders size={13} />
            <span>{uiDensity === 'COMPACT' ? 'COMPACT' : 'DENSITY'}</span>
          </button>

          {/* NATIVE FULLSCREEN TOGGLE */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Native Fullscreen (Hotkey: F)"
            style={{
              background: isFullscreen ? 'rgba(0, 229, 255, 0.25)' : 'rgba(10, 25, 40, 0.8)',
              border: `1px solid ${isFullscreen ? '#00e5ff' : 'rgba(0, 229, 255, 0.3)'}`,
              color: isFullscreen ? '#00e5ff' : '#80deea',
              borderRadius: '4px',
              padding: '5px 7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          <button
            onClick={() => setIsBriefingOpen(true)}
            title="Operational Briefing & Doctrine"
            style={{
              background: 'rgba(10, 25, 40, 0.8)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              color: '#80deea',
              borderRadius: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <HelpCircle size={14} /> BRIEFING
          </button>

          <button
            onClick={() => setIsAAROpen(true)}
            style={{
              background: 'linear-gradient(90deg, #00e5ff, #00b0ff)',
              border: 'none',
              color: '#040d1a',
              borderRadius: '4px',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              letterSpacing: '0.8px',
              boxShadow: '0 0 15px rgba(0, 229, 255, 0.4)',
            }}
          >
            <Award size={14} /> AAR DEBRIEF
          </button>
        </div>
      </header>

      {/* MOBILE / TABLET DISPLAY TAB SELECTOR (Auto-activated via CSS on <=1024px screens) */}
      <div className="mobile-tab-bar" style={{
        display: 'none',
        background: 'rgba(5, 15, 25, 0.95)',
        borderBottom: '1px solid rgba(0, 229, 255, 0.25)',
        padding: '5px 12px',
        justifyContent: 'center',
        gap: '8px',
        zIndex: 90,
      }}>
        <button
          onClick={() => setMobileTab('MAP')}
          style={{
            flex: 1,
            background: mobileTab === 'MAP' ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
            border: `1px solid ${mobileTab === 'MAP' ? '#00e5ff' : 'rgba(255,255,255,0.15)'}`,
            color: mobileTab === 'MAP' ? '#00e5ff' : '#90a4ae',
            padding: '6px',
            fontSize: '11px',
            fontWeight: 700,
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🗺️ 3D SANDTABLE
        </button>
        <button
          onClick={() => setMobileTab('CONSOLE')}
          style={{
            flex: 1,
            background: mobileTab === 'CONSOLE' ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
            border: `1px solid ${mobileTab === 'CONSOLE' ? '#00e5ff' : 'rgba(255,255,255,0.15)'}`,
            color: mobileTab === 'CONSOLE' ? '#00e5ff' : '#90a4ae',
            padding: '6px',
            fontSize: '11px',
            fontWeight: 700,
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          📡 C2 CONSOLE
        </button>
      </div>

      {/* MAIN TWO-PANE STAGE */}
      <main 
        className={`app-c2-main layout-${layoutMode.toLowerCase()}`} 
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: layoutMode === 'THEATER' ? '1fr 0px' : layoutMode === 'SPLIT' ? '1fr 1fr' : 'minmax(0, 1fr) minmax(360px, 440px)',
          overflow: 'hidden',
          position: 'relative',
          minHeight: 0,
        }}
      >
        {/* LEFT / CENTER: 3D HOLOGRAPHIC SANDTABLE */}
        <div 
          className={`sandtable-wrapper ${mobileTab === 'CONSOLE' ? 'mobile-hide-on-map' : ''}`}
          style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
        >
          <Sandtable3D
            units={units}
            selectedUnitId={selectedUnitId}
            onSelectUnit={(unit) => setSelectedUnitId(unit.id)}
            showGroundTruth={showGroundTruth}
            ewJammingIntensity={ewJammingIntensity}
            cameraMode={cameraMode}
            onCameraModeChange={setCameraMode}
            ballisticMission={ballisticMission}
          />

          {/* THEATER MODE RESTORE BUTTON OVERLAY */}
          {layoutMode === 'THEATER' && (
            <div
              onClick={() => setLayoutMode('STANDARD')}
              title="Click or press 'T' to restore Tactical Console"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                zIndex: 60,
                background: 'rgba(4, 14, 26, 0.92)',
                border: '1px solid #00e5ff',
                borderRadius: '6px',
                padding: '8px 14px',
                color: '#00e5ff',
                boxShadow: '0 0 20px rgba(0, 229, 255, 0.45)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '1px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <PanelRightOpen size={16} />
              <span>RESTORE C2 CONSOLE (T)</span>
            </div>
          )}
        </div>

        {/* RIGHT: TACTICAL C2 CONTROLLER OR INSTRUCTOR DASHBOARD */}
        <div 
          className={`c2-console-pane ${layoutMode === 'THEATER' ? 'theater-hidden' : ''} ${mobileTab === 'MAP' ? 'mobile-hide-on-console' : ''}`}
          style={{
            background: 'rgba(3, 10, 18, 0.96)',
            borderLeft: layoutMode === 'THEATER' ? 'none' : '1px solid rgba(0, 229, 255, 0.25)',
            padding: layoutMode === 'THEATER' ? '0' : '10px',
            height: '100%',
            overflow: 'hidden',
            display: layoutMode === 'THEATER' ? 'none' : 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {activeRole.id === 'INSTRUCTOR_WHITE_CELL' ? (
            <InstructorDashboard
              commsMetrics={commsMetrics}
              onUpdateComms={(updates) => setCommsMetrics(prev => ({ ...prev, ...updates }))}
              ewJammingIntensity={ewJammingIntensity}
              onUpdateEWIntensity={setEwJammingIntensity}
              showGroundTruth={showGroundTruth}
              onToggleGroundTruth={() => setShowGroundTruth(!showGroundTruth)}
              decisions={decisions}
              onInjectEvent={handleInjectEvent}
              onOpenAAR={() => setIsAAROpen(true)}
              exerciseTimeSec={exerciseTimeSec}
              onResetExercise={handleResetExercise}
            />
          ) : (
            <TacticalCOP
              units={units}
              selectedUnit={selectedUnit}
              onSelectUnit={(u) => setSelectedUnitId(u.id)}
              commsMetrics={commsMetrics}
              onUpdateComms={(updates) => setCommsMetrics(prev => ({ ...prev, ...updates }))}
              radioChatter={radioChatter}
              onSendRadioMessage={(text) => {
                const newMsg: RadioMessage = {
                  id: `MSG-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString(),
                  senderCallsign: activeRole.title.split(' ')[0],
                  domain: activeRole.id === 'AIR_CONTROLLER' ? 'AIR' : activeRole.id === 'EW_CYBER_OFFICER' ? 'EW' : 'LAND',
                  text,
                  priority: 'PRIORITY',
                  audioNoiseRatio: Math.max(0.1, 1 - commsMetrics.snr / 30),
                  admiralty: {
                    reliability: 'A',
                    credibility: 1,
                    source: `Combat Net Radio (${activeRole.title})`,
                    ageSec: 0,
                  }
                };
                setRadioChatter(prev => [newMsg, ...prev]);
                audioEngine.playRadioMessageBurst(0.2);

                // EMCON physics: radio burst raises RF signature and transmission counter
                setEmconState(prev => ({
                  ...prev,
                  rfSignaturePct: Math.min(100, prev.rfSignaturePct + 12),
                  totalTransmissionsCount: prev.totalTransmissionsCount + 1,
                }));
              }}
              onExecuteDecision={handleExecuteDecision}
              activeRole={activeRole}
              emconState={emconState}
              activeVerifications={activeVerifications}
              pendingSpoofedOrder={pendingSpoofedOrder}
              onStartVerification={handleStartVerification}
              onRespondSpoofedOrder={handleRespondSpoofedOrder}
            />
          )}
        </div>
      </main>

      {/* BRIEFING MODAL */}
      {isBriefingOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10001,
          padding: '20px',
        }}>
          <div style={{
            background: '#071626',
            border: '2px solid #00e5ff',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '680px',
            color: '#e0f7fa',
            boxShadow: '0 0 35px rgba(0,229,255,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={22} color="#00e5ff" />
                <h2 style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'Rajdhani, sans-serif', margin: 0 }}>
                  TACTICAL MISSION BRIEFING • {currentScenario.title}
                </h2>
              </div>
              <button
                onClick={() => setIsBriefingOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#90a4ae', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'rgba(10, 25, 45, 0.7)', padding: '14px', borderRadius: '6px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: '#ffb700', fontWeight: 700, marginBottom: '4px' }}>
                OPERATIONAL ENVIRONMENT & THREAT SITUATION:
              </div>
              <div style={{ fontSize: '12.5px', lineHeight: 1.6, color: '#cfd8dc' }}>
                {currentScenario.briefing}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(5, 15, 25, 0.8)', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', color: '#80deea' }}>THEATER SECTOR</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{currentScenario.theater}</div>
              </div>
              <div style={{ background: 'rgba(5, 15, 25, 0.8)', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', color: '#80deea' }}>TERRAIN ELEVATION</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{currentScenario.elevation}</div>
              </div>
              <div style={{ background: 'rgba(5, 15, 25, 0.8)', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', color: '#80deea' }}>WEATHER STATE</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#00ff66' }}>{currentScenario.weather}</div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 183, 0, 0.15)',
              border: '1px dashed #ffb700',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '11.5px',
              color: '#ffe082',
              lineHeight: 1.5,
              marginBottom: '16px',
            }}>
              <strong>DSSC Evaluation Criteria:</strong> Trainees will be judged not just on neutralization of OPFOR probes, but on their ability to resist premature kinetic escalation, recognize deceptive electronic signatures, document tactical rationale, and manage emission control (EMCON).
            </div>

            <button
              onClick={() => setIsBriefingOpen(false)}
              style={{
                width: '100%',
                background: '#00e5ff',
                border: 'none',
                color: '#040d1a',
                borderRadius: '4px',
                padding: '10px',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '1px',
                cursor: 'pointer',
              }}
            >
              ACKNOWLEDGE & ENTER COMBAT POST
            </button>
          </div>
        </div>
      )}

      {/* AFTER ACTION REVIEW (AAR) MODAL */}
      <AARModal
        isOpen={isAAROpen}
        onClose={() => setIsAAROpen(false)}
        scenario={currentScenario}
        exerciseTimeSec={exerciseTimeSec}
        decisions={decisions}
        commsMetrics={commsMetrics}
        units={units}
        timelineSnapshots={timelineSnapshots}
        emconState={emconState}
      />
    </div>
  );
}

export default App;
