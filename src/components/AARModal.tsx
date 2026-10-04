import React, { useState, useRef } from 'react';
import type { 
  TraineeDecision, 
  ScenarioDefinition, 
  CommsMetrics, 
  TacticalUnit,
  TimelineSnapshot,
  CounterfactualReplayFork,
  EMCONState 
} from '../types/tactical';
import { 
  Printer, 
  Download, 
  X, 
  Award, 
  Clock, 
  Shield, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp,
  GitFork,
  CheckCircle2,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface AARModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: ScenarioDefinition;
  exerciseTimeSec: number;
  decisions: TraineeDecision[];
  commsMetrics: CommsMetrics;
  units: TacticalUnit[];
  timelineSnapshots: TimelineSnapshot[];
  emconState?: EMCONState;
}

export const AARModal: React.FC<AARModalProps> = ({
  isOpen,
  onClose,
  scenario,
  exerciseTimeSec,
  decisions,
  commsMetrics,
  units,
  timelineSnapshots,
  emconState,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'REPLAY_SCRUBBER' | 'CALIBRATION' | 'TIMELINE' | 'COUNTERFACTUAL' | 'DISPATCH'>('REPLAY_SCRUBBER');
  
  // Interactive Timeline Scrubber index
  const [scrubberIndex, setScrubberIndex] = useState<number>(
    timelineSnapshots.length > 0 ? timelineSnapshots.length - 1 : 0
  );

  // Counterfactual Interactive Replay State
  const [selectedForkDecisionIdx, setSelectedForkDecisionIdx] = useState<number>(0);
  const [selectedAltAction, setSelectedAltAction] = useState<TraineeDecision['actionType']>('CHALLENGE_IFF_KEY');
  const [activeCounterfactual, setActiveCounterfactual] = useState<CounterfactualReplayFork | null>(null);

  const evaluationMeta = {
    id: `DSSC-AAR-${scenario.id.slice(0, 8).toUpperCase()}-2026`,
    date: '04 OCT 2026',
  };

  if (!isOpen) return null;

  const currentSnapshot = timelineSnapshots[scrubberIndex] || {
    timeSec: exerciseTimeSec,
    label: 'Current State',
    groundTruthUnits: units,
    perceivedUnits: units,
    ewJammingKw: 45,
    snr: commsMetrics.snr,
    latencySec: commsMetrics.latencyMs / 1000,
    packetLoss: commsMetrics.packetLoss,
    activeDisruptions: ['EW Barrage Jamming', 'Datalink Latency'],
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Evaluation Calculations
  const accurateStrikes = decisions.filter(d => d.evaluatedEffect === 'ACCURATE_STRIKE' || d.evaluatedEffect === 'EFFECTIVE_COUNTERMEASURE').length;
  const friendlyFireRisks = decisions.filter(d => d.evaluatedEffect === 'FRIENDLY_FIRE_RISK').length;
  const missedGhosts = decisions.filter(d => d.evaluatedEffect === 'MISSED_GHOST').length;

  // Navy Degraded Comms Study Metric: Measures whether trainee actively compensated via alternate sensors
  const verificationCount = decisions.filter(
    d => d.actionType === 'CHALLENGE_IFF_KEY' || 
         d.actionType === 'DISPATCH_RECCE_DRONE' || 
         d.actionType === 'AUTHENTICATE_RADIO_ORDER' ||
         d.actionType === 'HOLD_FIRE_VERIFY'
  ).length;

  const verificationRatePct = decisions.length > 0 
    ? Math.round((verificationCount / decisions.length) * 100) 
    : (decisions.some(d => d.actionType === 'CHALLENGE_IFF_KEY') ? 100 : 40);

  const compensationScore = Math.min(100, Math.max(25, Math.round(
    (verificationRatePct * 0.55) + 
    (commsMetrics.hoppingRateHps > 0 ? 25 : 0) + 
    (commsMetrics.emconLevel === 3 ? 20 : 10)
  )));

  const verificationScore = Math.min(100, Math.max(30, Math.round(
    decisions.some(d => d.actionType === 'CHALLENGE_IFF_KEY' || d.actionType === 'DISPATCH_RECCE_DRONE' || d.actionType === 'AUTHENTICATE_RADIO_ORDER') ? 92 : 45
  )));

  const ewDisciplineScore = Math.min(100, Math.max(35, Math.round(
    (commsMetrics.hoppingRateHps > 0 ? 50 : 20) + (emconState && emconState.rfSignaturePct < 40 ? 45 : 25)
  )));

  const overallDoctrineScore = Math.max(25, Math.min(100, Math.round(
    (accurateStrikes * 22 + verificationScore * 0.3 + compensationScore * 0.3 + ewDisciplineScore * 0.2) - (friendlyFireRisks * 30 + missedGhosts * 15)
  )));

  // Calibration Engine
  // Measures overconfidence: Did commander report 4-5 confidence on ghost/failed targets?
  const overconfidentDecisions = decisions.filter(
    d => d.confidenceLevel >= 4 && (d.evaluatedEffect === 'MISSED_GHOST' || d.evaluatedEffect === 'FRIENDLY_FIRE_RISK')
  );
  const wellCalibratedDecisions = decisions.filter(
    d => (d.confidenceLevel >= 3 && d.evaluatedEffect === 'ACCURATE_STRIKE') ||
         (d.confidenceLevel <= 2 && (d.evaluatedEffect === 'SUB_OPTIMAL_DELAY' || d.actionType === 'DISPATCH_RECCE_DRONE'))
  );

  let calibrationVerdict = 'WELL_CALIBRATED';
  let calibrationNote = 'Commander demonstrated strong calibration between confidence and factual intelligence accuracy.';
  if (overconfidentDecisions.length > 0) {
    calibrationVerdict = 'DANGEROUSLY_OVERCONFIDENT';
    calibrationNote = 'Commander committed high-order kinetic fires with 4-5 star confidence upon unverified/spoofed targets.';
  } else if (decisions.length > 0 && wellCalibratedDecisions.length === 0) {
    calibrationVerdict = 'OVERLY_HESITANT';
    calibrationNote = 'Commander exhibited excessive hesitation despite corroborated multi-source intelligence.';
  }

  let grade = 'B+ (SATISFACTORY UNDER UNCERTAINTY)';
  let gradeColor = '#00e5ff';
  if (overallDoctrineScore >= 85) {
    grade = 'A (DISTINCTION - EXCELLENT C2 DISCIPLINE)';
    gradeColor = '#00ff66';
  } else if (overallDoctrineScore < 60) {
    grade = 'C- (REMEDIAL TRAINING REQUIRED - VULNERABLE TO DECEPTION)';
    gradeColor = '#ff3344';
  }

  // Deterministic Counterfactual Fork Engine
  const handleGenerateCounterfactual = () => {
    const dec = decisions[selectedForkDecisionIdx] || {
      id: 'DEC-SAMPLE-01',
      commanderCallsign: 'SUB_UNIT_CDR',
      actionType: 'ARTILLERY_FIRE_MISSION',
      targetUnitId: 'OPFOR-RADAR-DECOY',
      targetCallsign: 'BOGEY-9 (CYBER PHANTOM)',
      targetPos: { x: -5, y: 32, z: 15, gridRef: '43X MH 7920 8430' },
      uncertaintyAtTime: 1500,
      rationale: 'Radar track indicates enemy air-ground strike inbound. Rapid kinetic suppression authorized before visual confirmation.',
      confidenceLevel: 5,
      timestamp: '14:22:15',
      exerciseElapsedSec: 225,
      evaluatedEffect: 'MISSED_GHOST',
      scoreDelta: -20,
      feedback: 'BLUNDER: Artillery committed to unverified cyber ghost contact. 48 rounds of 155mm ammunition depleted.',
      groundTruthDeviationMeters: 1450,
    };

    let scoreDiff = 44;
    let roundsSaved = 48;
    let casualtiesAvoided = 0;
    let rfAverted = 68;
    const actualNarrative = `At T+${formatTime(dec.exerciseElapsedSec)}, Commander executed ${dec.actionType.replace(/_/g, ' ')} with confidence ${dec.confidenceLevel}/5 on target ${dec.targetCallsign || 'GENERAL SECTOR'}. This resulted in expenditure of critical 155mm battery stocks on an electronic ghost/decoy and caused a massive radio telemetry burst that elevated RF signature to 82%, triggering OPFOR Direction Finding triangulation against the Command Post.`;
    let altNarrative = '';
    let doctrine = '';

    if (selectedAltAction === 'CHALLENGE_IFF_KEY') {
      scoreDiff = 44;
      roundsSaved = 48;
      rfAverted = 62;
      altNarrative = `By executing a 0.2-second CHALLENGE IFF KEY burst, the Commander received an invalid cryptographic parity response within 15 seconds. The track was identified as a Krasukha-4 deception target. Zero artillery rounds expended. Command Post coordinates remained uncompromised.`;
      doctrine = 'Directing Staff Doctrine (WARDEC-EW-04): Prior to kinetic battery release against ambiguous radar tracks, cryptographic challenge must be issued. Deception tracks lack rolling daily crypto keys.';
    } else if (selectedAltAction === 'DISPATCH_RECCE_DRONE') {
      scoreDiff = 38;
      roundsSaved = 48;
      rfAverted = 50;
      altNarrative = `By tasking a forward Optical RECCE Drone, line-of-sight visual telemetry confirmed completely empty terrain at the reported coordinates in 20 seconds. 48 artillery rounds conserved for the genuine armored advance through the defile.`;
      doctrine = 'Directing Staff Doctrine (Multi-Sensor Fusion): Secondary optical verification provides physical ground truth immunity against electronic spoofing and radar ghost injections.';
    } else if (selectedAltAction === 'EMCON_SILENCE_ORDER') {
      scoreDiff = 34;
      roundsSaved = 48;
      rfAverted = 85;
      casualtiesAvoided = 4;
      altNarrative = `Imposing strict EMCON Radio Silence denied hostile direction-finding sensors the transmission bearings needed to calculate a fire solution on the Battalion CP. Enemy BM-30 Smerch rocket salvo was completely averted.`;
      doctrine = 'Directing Staff Doctrine (EMCON Discipline): Radio silence is an active defense. In modern near-peer EW theaters, every radio burst has an adversarial artillery shell waiting at the other end.';
    } else if (selectedAltAction === 'AUTHENTICATE_RADIO_ORDER') {
      scoreDiff = 48;
      roundsSaved = 0;
      casualtiesAvoided = 18;
      altNarrative = `By challenging the spoofed retreat order with a daily Shackle Code, the Commander uncovered an adversary deepfake deception operation attempting to force an uncoordinated withdrawal. The defensive ridgeline was held.`;
      doctrine = 'Directing Staff Doctrine (Deception Resistance): Orders countermanding the primary mission must undergo challenge-reply authentication regardless of who the voice purports to be.';
    } else {
      scoreDiff = 25;
      roundsSaved = 36;
      rfAverted = 45;
      altNarrative = `Holding fire and awaiting secondary sensor cross-check prevented premature ammunition depletion and allowed the real hostile armor column to be positively identified at Point 4820.`;
      doctrine = 'Directing Staff Doctrine (Patience Under Ambiguity): Hasty tactical fires in jammed sectors consistently benefit the adversary by revealing friendly firing post locations.';
    }

    const fork: CounterfactualReplayFork = {
      forkId: `FORK-${Date.now().toString().slice(-4)}`,
      decisionId: dec.id,
      originalAction: dec.actionType,
      alternateAction: selectedAltAction,
      timeSec: dec.exerciseElapsedSec,
      scoreDifference: scoreDiff,
      projectedAmmunitionRoundsSaved: roundsSaved,
      projectedCasualtiesAvoided: casualtiesAvoided,
      projectedRfSignatureAvoidedPct: rfAverted,
      actualOutcomeNarrative: actualNarrative,
      counterfactualNarrative: altNarrative,
      doctrineTakeaway: doctrine,
      divergencePoints: [
        {
          metricName: '155mm Munitions Expended',
          actualValue: `${roundsSaved} Rounds (Depleted on Decoy)`,
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
          actualValue: dec.feedback,
          counterfactualValue: 'Decoy Neutralized / Strategic Reserve Maintained',
          impact: 'TACTICAL_ADVANTAGE',
        },
      ],
    };

    setActiveCounterfactual(fork);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const data = {
      exerciseCode: scenario.id,
      title: scenario.title,
      durationSeconds: exerciseTimeSec,
      overallDoctrineScore,
      grade,
      calibrationVerdict,
      decisions,
      commsMetricsAtEnd: commsMetrics,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AAR_${scenario.id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(2, 6, 12, 0.94)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000,
      padding: '16px',
    }}>
      <div style={{
        background: '#040d18',
        border: '2px solid #00e5ff',
        borderRadius: '10px',
        width: '1080px',
        maxWidth: '96vw',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 50px rgba(0, 229, 255, 0.25)',
        overflow: 'hidden',
      }}>
        {/* TOP COMMAND HEADER */}
        <div style={{
          background: 'rgba(5, 20, 35, 0.98)',
          borderBottom: '1px solid rgba(0, 229, 255, 0.3)',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={22} color="#00e5ff" />
            <div>
              <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '1px', color: '#00e5ff', fontFamily: 'Rajdhani, sans-serif' }}>
                DEFENCE SERVICES STAFF COLLEGE • AFTER ACTION REVIEW (AAR)
              </span>
              <div style={{ fontSize: '10px', color: '#80deea' }}>
                EXERCISE: {scenario.title} [{scenario.theater}]
              </div>
            </div>
          </div>

          {/* TAB BUTTONS */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('REPLAY_SCRUBBER')}
              style={{
                background: activeTab === 'REPLAY_SCRUBBER' ? 'rgba(0, 229, 255, 0.3)' : 'transparent',
                border: `1px solid ${activeTab === 'REPLAY_SCRUBBER' ? '#00e5ff' : 'rgba(255, 255, 255, 0.15)'}`,
                color: activeTab === 'REPLAY_SCRUBBER' ? '#00e5ff' : '#90a4ae',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Eye size={13} /> GROUND TRUTH VS WHAT YOU SAW
            </button>

            <button
              onClick={() => setActiveTab('CALIBRATION')}
              style={{
                background: activeTab === 'CALIBRATION' ? 'rgba(255, 183, 0, 0.3)' : 'transparent',
                border: `1px solid ${activeTab === 'CALIBRATION' ? '#ffb700' : 'rgba(255, 255, 255, 0.15)'}`,
                color: activeTab === 'CALIBRATION' ? '#ffb700' : '#90a4ae',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <TrendingUp size={13} /> CONFIDENCE CALIBRATION
            </button>

            <button
              onClick={() => setActiveTab('TIMELINE')}
              style={{
                background: activeTab === 'TIMELINE' ? 'rgba(0, 255, 102, 0.3)' : 'transparent',
                border: `1px solid ${activeTab === 'TIMELINE' ? '#00ff66' : 'rgba(255, 255, 255, 0.15)'}`,
                color: activeTab === 'TIMELINE' ? '#00ff66' : '#90a4ae',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Clock size={13} /> DECISION AUDIT
            </button>

            <button
              onClick={() => {
                setActiveTab('COUNTERFACTUAL');
                if (!activeCounterfactual) {
                  handleGenerateCounterfactual();
                }
              }}
              style={{
                background: activeTab === 'COUNTERFACTUAL' ? 'rgba(186, 104, 200, 0.35)' : 'transparent',
                border: `1px solid ${activeTab === 'COUNTERFACTUAL' ? '#ba68c8' : 'rgba(255, 255, 255, 0.15)'}`,
                color: activeTab === 'COUNTERFACTUAL' ? '#ce93d8' : '#90a4ae',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <GitFork size={13} /> BRANCHING "WHAT IF?" REPLAY
            </button>

            <button
              onClick={() => setActiveTab('DISPATCH')}
              style={{
                background: activeTab === 'DISPATCH' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                border: `1px solid ${activeTab === 'DISPATCH' ? '#fff' : 'rgba(255, 255, 255, 0.15)'}`,
                color: activeTab === 'DISPATCH' ? '#fff' : '#90a4ae',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              OFFICIAL DISPATCH
            </button>
          </div>

          {/* ACTIONS */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: 'rgba(0, 229, 255, 0.15)',
                border: '1px solid #00e5ff',
                color: '#80deea',
                borderRadius: '4px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Printer size={13} /> PRINT
            </button>

            <button
              onClick={handleExportJSON}
              style={{
                background: 'rgba(0, 255, 102, 0.15)',
                border: '1px solid #00ff66',
                color: '#b9f6ca',
                borderRadius: '4px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Download size={13} /> EXPORT
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#90a4ae',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* TAB 1: INTERACTIVE SIDE-BY-SIDE REPLAY SCRUBBER (THE WOW MOMENT) */}
        {activeTab === 'REPLAY_SCRUBBER' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
            padding: '16px',
            gap: '14px',
          }}>
            {/* TIMELINE SCRUBBER CONTROL BAR */}
            <div style={{
              background: 'rgba(10, 25, 45, 0.8)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="#00e5ff" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#00e5ff', letterSpacing: '1px' }}>
                    EXERCISE TIMELINE SCRUBBER
                  </span>
                  <span style={{
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono, monospace',
                    background: 'rgba(0, 229, 255, 0.2)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    color: '#fff',
                    fontWeight: 700,
                  }}>
                    T+{formatTime(currentSnapshot.timeSec)}
                  </span>
                  <span style={{ fontSize: '11px', color: '#80deea' }}>
                    {currentSnapshot.label}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    disabled={scrubberIndex <= 0}
                    onClick={() => setScrubberIndex(prev => Math.max(0, prev - 1))}
                    style={{
                      background: 'rgba(0, 229, 255, 0.15)',
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                      color: scrubberIndex <= 0 ? '#546e7a' : '#00e5ff',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: scrubberIndex <= 0 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ChevronLeft size={16} /> PREV STEP
                  </button>

                  <button
                    disabled={scrubberIndex >= timelineSnapshots.length - 1}
                    onClick={() => setScrubberIndex(prev => Math.min(timelineSnapshots.length - 1, prev + 1))}
                    style={{
                      background: 'rgba(0, 229, 255, 0.15)',
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                      color: scrubberIndex >= timelineSnapshots.length - 1 ? '#546e7a' : '#00e5ff',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: scrubberIndex >= timelineSnapshots.length - 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    NEXT STEP <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* SCRUBBER SLIDER */}
              <input
                type="range"
                min={0}
                max={Math.max(0, timelineSnapshots.length - 1)}
                value={scrubberIndex}
                onChange={(e) => setScrubberIndex(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#00e5ff' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#90a4ae' }}>
                <span>T+00:00 (Scenario Start)</span>
                <span>Active Jammer: {currentSnapshot.ewJammingKw} kW | SNR: {currentSnapshot.snr.toFixed(1)} dB | Delay: {currentSnapshot.latencySec.toFixed(1)}s</span>
                <span>T+{formatTime(exerciseTimeSec)} (Present)</span>
              </div>
            </div>

            {/* DUAL VIEWPORTS (GROUND TRUTH VS WHAT YOU SAW) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
              flex: 1,
              overflow: 'hidden',
            }}>
              {/* LEFT VIEWPORT: GROUND TRUTH REALITY */}
              <div style={{
                background: 'rgba(10, 15, 25, 0.9)',
                border: '2px solid #00ff66',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 0 20px rgba(0, 255, 102, 0.1)',
                overflowY: 'auto',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color="#00ff66" />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#00ff66', letterSpacing: '1px' }}>
                      GROUND TRUTH REALITY (GOD'S EYE)
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', background: 'rgba(0, 255, 102, 0.15)', color: '#00ff66', padding: '2px 6px', borderRadius: '3px' }}>
                    CANONICAL STATE
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#cfd8dc' }}>
                  What was physically occurring in the mountain sector:
                </div>

                {/* UNIT LIST (GROUND TRUTH) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {currentSnapshot.groundTruthUnits.map((u) => {
                    const isBlu = u.affiliation === 'BLUFOR';
                    if (u.isGhostContact) {
                      return (
                        <div key={u.id} style={{
                          background: 'rgba(255, 23, 68, 0.1)',
                          border: '1px dashed #ff3344',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#ff8a80',
                        }}>
                          <strong style={{ color: '#ff3344' }}>NON-EXISTENT SPOOF TARGET:</strong> {u.callsign} has zero physical reality. Injected into radar datalink by cyber spoofing!
                        </div>
                      );
                    }
                    return (
                      <div key={u.id} style={{
                        background: 'rgba(15, 30, 45, 0.7)',
                        borderLeft: `3px solid ${isBlu ? '#00e5ff' : '#ff3344'}`,
                        padding: '6px 8px',
                        borderRadius: '0 4px 4px 0',
                        fontSize: '11px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{ color: isBlu ? '#80deea' : '#ff8a80' }}>{u.callsign}</strong>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#90a4ae' }}>
                            {u.groundTruthPos.gridRef}
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#b0bec5' }}>
                          Real Status: {u.status} | Speed: {u.speed} km/h | Elevation: {u.altitude}m
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT VIEWPORT: WHAT THE COMMANDER SAW */}
              <div style={{
                background: 'rgba(10, 15, 25, 0.9)',
                border: '2px solid #ffb700',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 0 20px rgba(255, 183, 0, 0.1)',
                overflowY: 'auto',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Eye size={16} color="#ffb700" />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffb700', letterSpacing: '1px' }}>
                      WHAT THE COMMANDER SAW (DEGRADED PICTURE)
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', background: 'rgba(255, 183, 0, 0.15)', color: '#ffb700', padding: '2px 6px', borderRadius: '3px' }}>
                    DEGRADED BY EW / CYBER
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#cfd8dc' }}>
                  The incomplete, delayed, and spoofed picture on the tactical C2 console:
                </div>

                {/* UNIT LIST (PERCEIVED) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {currentSnapshot.perceivedUnits.map((u) => {
                    const isBlu = u.affiliation === 'BLUFOR';
                    return (
                      <div key={u.id} style={{
                        background: 'rgba(15, 30, 45, 0.7)',
                        borderLeft: `3px solid ${u.isGhostContact ? '#d500f9' : isBlu ? '#00e5ff' : '#ff3344'}`,
                        padding: '6px 8px',
                        borderRadius: '0 4px 4px 0',
                        fontSize: '11px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{ color: u.isGhostContact ? '#ea80fc' : isBlu ? '#80deea' : '#ff8a80' }}>
                            {u.callsign} {u.isGhostContact && '(SUSPECTED GHOST)'}
                          </strong>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#ffb700' }}>
                            CEP: ±{u.uncertaintyRadius}m
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#b0bec5' }}>
                          Perceived Grid: {u.perceivedPos.gridRef} ({u.lastContactSecondsAgo}s stale)
                        </div>
                        {u.admiralty && (
                          <div style={{ fontSize: '9px', color: '#ffe082', marginTop: '2px' }}>
                            Admiralty: [{u.admiralty.reliability}{u.admiralty.credibility}] {u.admiralty.source}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* INSTANT DECISION CALLOUT AT THIS TIMESTAMP */}
            {currentSnapshot.decision && (
              <div style={{
                background: 'rgba(5, 20, 35, 0.95)',
                border: '1px solid #00e5ff',
                borderRadius: '6px',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#00e5ff', fontWeight: 700 }}>
                    COMMAND ORDER COMMITTED AT THIS INSTANT:
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                    {currentSnapshot.decision.actionType.replace(/_/g, ' ')} • Target: {currentSnapshot.decision.targetCallsign}
                  </div>
                  <div style={{ fontSize: '11px', color: '#b2ebf2', fontStyle: 'italic', marginTop: '2px' }}>
                    "{currentSnapshot.decision.rationale}"
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#ffb700' }}>
                    Confidence: {currentSnapshot.decision.confidenceLevel}/5
                  </div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: currentSnapshot.decision.evaluatedEffect === 'ACCURATE_STRIKE' ? '#00ff66' : '#ff3344'
                  }}>
                    {currentSnapshot.decision.feedback}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CONFIDENCE CALIBRATION SCORE */}
        {activeTab === 'CALIBRATION' && (
          <div style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: '#e0f7fa',
          }}>
            <div style={{
              background: 'rgba(10, 25, 45, 0.8)',
              border: '1px solid rgba(255, 183, 0, 0.3)',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <TrendingUp size={20} color="#ffb700" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'Rajdhani, sans-serif', color: '#ffb700', margin: 0 }}>
                  COMMAND CONFIDENCE CALIBRATION MATRIX
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: '#cfd8dc', lineHeight: 1.5, margin: 0 }}>
                In degraded environments, bad decisions are dangerous, but <em>overconfident</em> bad decisions are catastrophic. 
                The calibration index evaluates whether the commander's stated confidence (1 to 5) matched the objective veracity of the information.
              </p>
            </div>

            {/* CALIBRATION SUMMARY CARD */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
            }}>
              <div style={{ background: 'rgba(15, 30, 50, 0.8)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.2)' }}>
                <div style={{ fontSize: '11px', color: '#80deea' }}>CALIBRATION VERDICT</div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: 800,
                  fontFamily: 'Rajdhani, sans-serif',
                  color: calibrationVerdict === 'WELL_CALIBRATED' ? '#00ff66' : '#ff3344',
                  marginTop: '4px'
                }}>
                  {calibrationVerdict.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '10px', color: '#90a4ae', marginTop: '4px' }}>
                  {calibrationNote}
                </div>
              </div>

              <div style={{ background: 'rgba(15, 30, 50, 0.8)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.2)' }}>
                <div style={{ fontSize: '11px', color: '#80deea' }}>OVERCONFIDENCE INCIDENTS</div>
                <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: overconfidentDecisions.length > 0 ? '#ff3344' : '#00ff66', marginTop: '2px' }}>
                  {overconfidentDecisions.length}
                </div>
                <div style={{ fontSize: '10px', color: '#90a4ae' }}>
                  Orders with 4-5 confidence on spoofed or friendly units
                </div>
              </div>

              <div style={{ background: 'rgba(15, 30, 50, 0.8)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.2)' }}>
                <div style={{ fontSize: '11px', color: '#80deea' }}>WELL-CALIBRATED ACTIONS</div>
                <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#00ff66', marginTop: '2px' }}>
                  {wellCalibratedDecisions.length}
                </div>
                <div style={{ fontSize: '10px', color: '#90a4ae' }}>
                  Orders where confidence matched factual confirmation
                </div>
              </div>
            </div>

            {/* DECISION-BY-DECISION CALIBRATION BREAKDOWN */}
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#00e5ff', marginBottom: '8px' }}>
                DETAILED DECISION CALIBRATION BREAKDOWN:
              </h4>

              {decisions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#78909c', fontSize: '12px' }}>
                  No decisions recorded to calibrate.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {decisions.map((dec, idx) => {
                    const isOverconfident = dec.confidenceLevel >= 4 && (dec.evaluatedEffect === 'MISSED_GHOST' || dec.evaluatedEffect === 'FRIENDLY_FIRE_RISK');
                    return (
                      <div
                        key={dec.id}
                        style={{
                          background: 'rgba(10, 25, 45, 0.7)',
                          borderLeft: `4px solid ${isOverconfident ? '#ff3344' : '#00ff66'}`,
                          borderRadius: '0 6px 6px 0',
                          padding: '10px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>
                              #{idx + 1} {dec.actionType.replace(/_/g, ' ')}
                            </span>
                            <span style={{ fontSize: '11px', color: '#80deea' }}>
                              [Target: {dec.targetCallsign}]
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#b2ebf2', fontStyle: 'italic', marginTop: '2px' }}>
                            "{dec.rationale}"
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffb700' }}>
                            Tagged Confidence: {dec.confidenceLevel}/5
                          </div>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: isOverconfident ? '#ff3344' : '#00ff66'
                          }}>
                            {isOverconfident ? 'DANGEROUSLY OVERCONFIDENT' : 'CALIBRATED DECISION'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CHRONOLOGICAL DECISION AUDIT */}
        {activeTab === 'TIMELINE' && (
          <div style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'Rajdhani, sans-serif', color: '#00e5ff', margin: 0 }}>
                CHRONOLOGICAL DECISION TIMELINE & COMMANDER RATIONALE AUDIT
              </h3>
              <span style={{ fontSize: '11px', color: '#90a4ae' }}>
                Total Orders: {decisions.length}
              </span>
            </div>

            {decisions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#78909c', fontSize: '12px' }}>
                No decisions recorded during this exercise run.
              </div>
            ) : (
              decisions.map((dec, idx) => (
                <div
                  key={dec.id}
                  style={{
                    background: 'rgba(10, 25, 45, 0.8)',
                    border: '1px solid rgba(0, 229, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: '#00e5ff',
                        color: '#040d1a',
                        fontWeight: 800,
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                      }}>
                        #{idx + 1}
                      </span>
                      <strong style={{ color: '#fff', fontSize: '14px', fontFamily: 'Rajdhani, sans-serif' }}>
                        {dec.actionType.replace(/_/g, ' ')}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#80deea' }}>
                        Target: {dec.targetCallsign || 'GENERAL SECTOR'}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#00ff66' }}>
                      T+{formatTime(dec.exerciseElapsedSec)}
                    </span>
                  </div>

                  <div style={{
                    background: 'rgba(5, 15, 25, 0.8)',
                    border: '1px solid rgba(0, 229, 255, 0.15)',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    fontSize: '11.5px',
                    color: '#b2ebf2',
                    margin: '6px 0',
                  }}>
                    <strong style={{ color: '#00e5ff' }}>COMMANDER RATIONALE UNDER UNCERTAINTY:</strong>
                    <div style={{ fontStyle: 'italic', marginTop: '2px' }}>
                      "{dec.rationale}"
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
                    <span style={{ color: '#90a4ae' }}>
                      VERDICT: <strong style={{ color: dec.evaluatedEffect === 'ACCURATE_STRIKE' ? '#00ff66' : '#ff8a80' }}>{dec.feedback}</strong>
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: dec.scoreDelta >= 0 ? '#00ff66' : '#ff5252' }}>
                      {dec.scoreDelta >= 0 ? `+${dec.scoreDelta}` : dec.scoreDelta} PTS
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: BRANCHING COUNTERFACTUAL "WHAT IF?" REPLAY */}
        {activeTab === 'COUNTERFACTUAL' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflowY: 'auto',
            padding: '18px',
            gap: '16px',
            background: 'radial-gradient(circle at 50% 20%, rgba(186, 104, 200, 0.08), rgba(4, 13, 24, 0.95))',
          }}>
            {/* COUNTERFACTUAL CONTROLS BAR */}
            <div style={{
              background: 'rgba(10, 20, 35, 0.9)',
              border: '1px solid rgba(186, 104, 200, 0.35)',
              borderRadius: '8px',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 0 25px rgba(186, 104, 200, 0.1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GitFork size={18} color="#ce93d8" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#ce93d8', letterSpacing: '1px', fontFamily: 'Rajdhani, sans-serif' }}>
                      COUNTERFACTUAL REPLAY ENGINE • SEEDED TIMELINE FORK (WARDEC ATMANIRBHAR)
                    </div>
                    <div style={{ fontSize: '10px', color: '#b0bec5' }}>
                      Rewind to any historical decision point and simulate alternative Course of Action (COA) without stochastic drift.
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerateCounterfactual}
                  style={{
                    background: 'linear-gradient(135deg, #ba68c8, #7b1fa2)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '8px 16px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 15px rgba(186, 104, 200, 0.4)',
                  }}
                >
                  <RotateCcw size={13} /> RUN COUNTERFACTUAL FORK (WHAT IF?)
                </button>
              </div>

              {/* SELECTION DROPDOWNS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#ce93d8', fontWeight: 700, marginBottom: '4px' }}>
                    1. SELECT HISTORICAL DECISION POINT TO REWIND:
                  </label>
                  <select
                    value={selectedForkDecisionIdx}
                    onChange={(e) => setSelectedForkDecisionIdx(Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: 'rgba(5, 15, 25, 0.9)',
                      border: '1px solid rgba(186, 104, 200, 0.4)',
                      borderRadius: '4px',
                      padding: '8px 10px',
                      color: '#fff',
                      fontSize: '11px',
                      outline: 'none',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {decisions.length === 0 ? (
                      <option value={0}>Sample Decision: Order Artillery Strike on BOGEY-9 (Radar Ghost at T+03:45)</option>
                    ) : (
                      decisions.map((dec, idx) => (
                        <option key={dec.id} value={idx}>
                          #{idx + 1} [T+{formatTime(dec.exerciseElapsedSec)}] {dec.actionType} - Target: {dec.targetCallsign || 'GENERAL'} ({dec.scoreDelta >= 0 ? `+${dec.scoreDelta}` : dec.scoreDelta} pts)
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#ce93d8', fontWeight: 700, marginBottom: '4px' }}>
                    2. SELECT ALTERNATIVE DOCTRINE COURSE OF ACTION (COA):
                  </label>
                  <select
                    value={selectedAltAction}
                    onChange={(e) => setSelectedAltAction(e.target.value as TraineeDecision['actionType'])}
                    style={{
                      width: '100%',
                      background: 'rgba(5, 15, 25, 0.9)',
                      border: '1px solid rgba(186, 104, 200, 0.4)',
                      borderRadius: '4px',
                      padding: '8px 10px',
                      color: '#00ff66',
                      fontSize: '11px',
                      fontWeight: 700,
                      outline: 'none',
                    }}
                  >
                    <option value="CHALLENGE_IFF_KEY">CHALLENGE IFF KEY (Cryptographic Verification Burst - 15s)</option>
                    <option value="DISPATCH_RECCE_DRONE">TASK RECCE VERIFICATION (Optical UAV Line-of-Sight - 20s)</option>
                    <option value="EMCON_SILENCE_ORDER">IMPOSE STRICT EMCON (Radio Silence & Deny Hostile DF Triangulation)</option>
                    <option value="AUTHENTICATE_RADIO_ORDER">CHALLENGE SHACKLE CODE (Deception Resistance Authentication)</option>
                    <option value="HOLD_FIRE_VERIFY">HOLD FIRE & CROSS-CHECK (Corroborate Multi-Source Feeds)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SIDE-BY-SIDE PARALLEL TIMELINE PROJECTION */}
            {activeCounterfactual && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '14px',
                }}>
                  {/* LEFT: HISTORICAL RECORDED TIMELINE */}
                  <div style={{
                    background: 'rgba(25, 10, 15, 0.85)',
                    border: '2px solid #ff3344',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 0 20px rgba(255, 51, 68, 0.15)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={16} color="#ff3344" />
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#ff5252', letterSpacing: '1px' }}>
                          BRANCH A: HISTORICAL RECORDED EXECUTION
                        </span>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        background: 'rgba(255, 51, 68, 0.2)',
                        color: '#ff8a80',
                        padding: '2px 8px',
                        borderRadius: '3px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                      }}>
                        T+{formatTime(activeCounterfactual.timeSec ?? activeCounterfactual.forkTimeSec ?? 0)}
                      </span>
                    </div>

                    <div style={{
                      background: 'rgba(10, 5, 8, 0.8)',
                      padding: '10px',
                      borderRadius: '4px',
                      borderLeft: '3px solid #ff3344',
                      fontSize: '11.5px',
                      color: '#cfd8dc',
                      lineHeight: 1.5,
                    }}>
                      <div style={{ color: '#ff8a80', fontWeight: 700, marginBottom: '4px' }}>
                        COMMAND ORDER: {(activeCounterfactual.originalAction || activeCounterfactual.originalDecision?.actionType || '').replace(/_/g, ' ')}
                      </div>
                      {activeCounterfactual.actualOutcomeNarrative || activeCounterfactual.originalDecision?.feedback}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                      <div style={{ background: 'rgba(10, 20, 30, 0.6)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255, 51, 68, 0.2)' }}>
                        <div style={{ fontSize: '9px', color: '#90a4ae' }}>155MM AMMO CONSUMED</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#ff5252', fontFamily: 'JetBrains Mono, monospace' }}>
                          48 ROUNDS
                        </div>
                        <div style={{ fontSize: '9px', color: '#ff8a80' }}>Depleted on phantom decoy</div>
                      </div>

                      <div style={{ background: 'rgba(10, 20, 30, 0.6)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255, 51, 68, 0.2)' }}>
                        <div style={{ fontSize: '9px', color: '#90a4ae' }}>HOSTILE DF LOCK RISK</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#ff3344', fontFamily: 'JetBrains Mono, monospace' }}>
                          82% TRIANGULATED
                        </div>
                        <div style={{ fontSize: '9px', color: '#ff8a80' }}>CP coordinates compromised</div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: COUNTERFACTUAL ALTERNATIVE TIMELINE */}
                  <div style={{
                    background: 'rgba(10, 25, 20, 0.85)',
                    border: '2px solid #00ff66',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 0 25px rgba(0, 255, 102, 0.15)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={16} color="#00ff66" />
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#00ff66', letterSpacing: '1px' }}>
                          BRANCH B: COUNTERFACTUAL WHAT-IF PROJECTION
                        </span>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        background: 'rgba(0, 255, 102, 0.2)',
                        color: '#69f0ae',
                        padding: '2px 8px',
                        borderRadius: '3px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                      }}>
                        +{activeCounterfactual.scoreDifference ?? activeCounterfactual.projectedScoreDelta} PTS GAIN
                      </span>
                    </div>

                    <div style={{
                      background: 'rgba(5, 15, 10, 0.8)',
                      padding: '10px',
                      borderRadius: '4px',
                      borderLeft: '3px solid #00ff66',
                      fontSize: '11.5px',
                      color: '#e8f5e9',
                      lineHeight: 1.5,
                    }}>
                      <div style={{ color: '#00ff66', fontWeight: 700, marginBottom: '4px' }}>
                        ALTERNATIVE COA: {(activeCounterfactual.alternateAction || activeCounterfactual.alternativeAction || '').replace(/_/g, ' ')}
                      </div>
                      {activeCounterfactual.counterfactualNarrative || activeCounterfactual.projectedOutcome}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                      <div style={{ background: 'rgba(10, 20, 30, 0.6)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(0, 255, 102, 0.2)' }}>
                        <div style={{ fontSize: '9px', color: '#90a4ae' }}>155MM AMMO CONSERVED</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#00ff66', fontFamily: 'JetBrains Mono, monospace' }}>
                          +{activeCounterfactual.projectedAmmunitionRoundsSaved ?? activeCounterfactual.ammoSaved} ROUNDS
                        </div>
                        <div style={{ fontSize: '9px', color: '#b9f6ca' }}>Preserved for genuine breach</div>
                      </div>

                      <div style={{ background: 'rgba(10, 20, 30, 0.6)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(0, 255, 102, 0.2)' }}>
                        <div style={{ fontSize: '9px', color: '#90a4ae' }}>RF SIGNATURE REDUCTION</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#00e5ff', fontFamily: 'JetBrains Mono, monospace' }}>
                          -{activeCounterfactual.projectedRfSignatureAvoidedPct ?? activeCounterfactual.rfExposureAvoidedPct}% RF
                        </div>
                        <div style={{ fontSize: '9px', color: '#80deea' }}>Stealth & CP survivability intact</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STRATEGIC DIVERGENCE AUDIT TABLE */}
                <div style={{
                  background: 'rgba(10, 20, 35, 0.85)',
                  border: '1px solid rgba(0, 229, 255, 0.2)',
                  borderRadius: '6px',
                  padding: '12px',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#00e5ff', marginBottom: '8px', letterSpacing: '1px' }}>
                    QUANTITATIVE TIMELINE DIVERGENCE SCORECARD:
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(0, 229, 255, 0.2)', color: '#80deea', textAlign: 'left' }}>
                        <th style={{ padding: '6px' }}>METRIC</th>
                        <th style={{ padding: '6px' }}>ACTUAL TIMELINE</th>
                        <th style={{ padding: '6px' }}>COUNTERFACTUAL PROJECTION</th>
                        <th style={{ padding: '6px' }}>TACTICAL EVALUATION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeCounterfactual.divergencePoints || []).map((pt, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: '6px', fontWeight: 600, color: '#cfd8dc' }}>{pt.metricName}</td>
                          <td style={{ padding: '6px', color: '#ff8a80', fontFamily: 'JetBrains Mono, monospace' }}>{pt.actualValue}</td>
                          <td style={{ padding: '6px', color: '#69f0ae', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{pt.counterfactualValue}</td>
                          <td style={{ padding: '6px' }}>
                            <span style={{
                              background: pt.impact === 'CRITICAL_SAVINGS' ? 'rgba(0, 255, 102, 0.15)' : 'rgba(0, 229, 255, 0.15)',
                              color: pt.impact === 'CRITICAL_SAVINGS' ? '#00ff66' : '#00e5ff',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '9.5px',
                              fontWeight: 700,
                            }}>
                              {pt.impact.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* DOCTRINE TAKEAWAY CARD */}
                <div style={{
                  background: 'rgba(186, 104, 200, 0.1)',
                  border: '1px solid rgba(186, 104, 200, 0.35)',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  fontSize: '11.5px',
                  color: '#e1bee7',
                  lineHeight: 1.5,
                }}>
                  <strong style={{ color: '#ce93d8' }}>DSSC DIRECTING STAFF LESSON LEARNED:</strong>
                  <div style={{ marginTop: '3px' }}>
                    {activeCounterfactual.doctrineTakeaway || activeCounterfactual.projectedOutcome}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: OFFICIAL DISPATCH REPORT (PRINTABLE) */}
        {activeTab === 'DISPATCH' && (
          <div ref={printAreaRef} className="printable-aar" style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            color: '#e0f7fa',
            fontFamily: 'Inter, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div style={{
              borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
              paddingBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#ffb700', fontWeight: 700, letterSpacing: '2px' }}>
                  MINISTRY OF DEFENCE • DEFENCE SERVICES STAFF COLLEGE (DSSC)
                </div>
                <h1 style={{ margin: '4px 0', fontSize: '22px', fontWeight: 800, fontFamily: 'Rajdhani, sans-serif', color: '#fff' }}>
                  MULTI-DOMAIN DECISION-MAKING AUDIT (DEGRADED COMMS)
                </h1>
                <div style={{ fontSize: '12px', color: '#80deea' }}>
                  EXERCISE: <strong style={{ color: '#fff' }}>{scenario.title}</strong> [{scenario.theater}]
                </div>
              </div>

              <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#90a4ae' }}>
                <div>EVALUATION ID: {evaluationMeta.id}</div>
                <div>DATE: {evaluationMeta.date}</div>
                <div>EXERCISE DURATION: {formatTime(exerciseTimeSec)}</div>
              </div>
            </div>

            {/* SCORECARD */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 2fr',
              gap: '16px',
              background: 'rgba(10, 25, 45, 0.7)',
              border: '1px solid rgba(0, 229, 255, 0.2)',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <div style={{ borderRight: '1px solid rgba(0, 229, 255, 0.15)', paddingRight: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#90a4ae', fontWeight: 700 }}>OVERALL DOCTRINE RATING</div>
                <div style={{
                  fontSize: '44px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 800,
                  color: gradeColor,
                  margin: '8px 0',
                }}>
                  {overallDoctrineScore}<span style={{ fontSize: '20px' }}>/100</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: gradeColor }}>
                  {grade}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: '#80deea' }}>Tactical Initiative Under Uncertainty:</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{accurateStrikes > 0 ? '82%' : '40%'}</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${accurateStrikes > 0 ? 82 : 40}%`, height: '100%', background: '#00e5ff' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: '#80deea' }}>EW Threat Response & Comms Discipline:</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{ewDisciplineScore}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${ewDisciplineScore}%`, height: '100%', background: '#ffb700' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: '#80deea' }}>Deception Verification Discipline:</span>
                    <span style={{ fontWeight: 700, color: '#fff' }}>{verificationScore}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${verificationScore}%`, height: '100%', background: '#00ff66' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: '#80deea' }}>Compensation Index (Navy Degraded Comms Standard):</span>
                    <span style={{ fontWeight: 700, color: '#ce93d8' }}>{compensationScore}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${compensationScore}%`, height: '100%', background: '#ba68c8' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* DOCTRINE TAKEAWAYS */}
            <div style={{
              background: 'rgba(10, 25, 45, 0.6)',
              border: '1px solid rgba(255, 183, 0, 0.3)',
              borderRadius: '6px',
              padding: '14px',
            }}>
              <strong style={{ fontSize: '12px', color: '#ffb700' }}>
                DIRECTING STAFF TACTICAL DOCTRINE TAKEAWAYS (WARDEC ATMANIRBHAR STANDARD):
              </strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '11.5px', color: '#cfd8dc', lineHeight: 1.6 }}>
                <li>
                  <strong>Compensation Behavior (Navy Research Standard):</strong> Trainee demonstrated an alternate-sensor compensation index of <strong>{compensationScore}%</strong>. Under communications degradation, decision-makers who actively cross-corroborate through alternate channels (optical UAVs, physical runners, Shackle authentications) avert 94% of hostile deception traps compared to those who act on degraded primary datalinks.
                </li>
                <li>
                  <strong>Emission-Control (EMCON) Physics:</strong> Tactical combat net radios (CNR) broadcasting continuously allow OPFOR Krasukha-4 and SIGINT direction-finding assets to calculate triangulated firing solutions within 90 seconds. Enforcing strict radio silence or low-probability-of-intercept (LPI/FHSS) bursts maintains Command Post survivability.
                </li>
                <li>
                  <strong>Deception vs. Denial Awareness:</strong> While jamming denies transmission, cyber/GPS spoofing actively deceives. Orders countermanding primary operational plans must be challenged with pre-coordinated authentication codes before compliance.
                </li>
                <li>
                  <strong>Calibration of Confidence:</strong> Commanders must rigorously align subjective confidence with objective information age. High confidence upon unverified single-source feeds directly correlates with battlefield fratricide and reserve depletion.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
