import React, { useState } from 'react';
import type { 
  TacticalUnit, 
  TacticalDomain, 
  CommsMetrics, 
  RadioMessage, 
  TraineeDecision, 
  TraineeRole,
  EMCONState,
  VerificationAction,
  SpoofedRadioOrder
} from '../types/tactical';
import { audioEngine } from '../services/audioEngine';
import { 
  Shield, 
  Radio, 
  Crosshair, 
  AlertTriangle, 
  Activity, 
  Volume2, 
  VolumeX, 
  RotateCw, 
  Send, 
  Cpu, 
  Lock, 
  Eye,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  Footprints,
  Clock
} from 'lucide-react';

interface TacticalCOPProps {
  units: TacticalUnit[];
  selectedUnit: TacticalUnit | null;
  onSelectUnit: (unit: TacticalUnit) => void;
  commsMetrics: CommsMetrics;
  onUpdateComms: (metrics: Partial<CommsMetrics>) => void;
  radioChatter: RadioMessage[];
  onSendRadioMessage: (text: string) => void;
  onExecuteDecision: (decision: Omit<TraineeDecision, 'id' | 'timestamp' | 'exerciseElapsedSec' | 'evaluatedEffect' | 'scoreDelta' | 'feedback' | 'groundTruthDeviationMeters'>) => void;
  activeRole: TraineeRole;
  exerciseTimeSec?: number;
  emconState?: EMCONState;
  activeVerifications?: VerificationAction[];
  pendingSpoofedOrder?: SpoofedRadioOrder;
  onStartVerification?: (actionType: VerificationAction['type'], targetRef: string, label: string, durationSec: number) => void;
  onRespondSpoofedOrder?: (orderId: string, action: 'AUTHENTICATE' | 'REJECT_AS_DECEPTION' | 'BLINDLY_OBEY') => void;
}

export const TacticalCOP: React.FC<TacticalCOPProps> = ({
  units,
  selectedUnit,
  onSelectUnit,
  commsMetrics,
  onUpdateComms,
  radioChatter,
  onSendRadioMessage,
  onExecuteDecision,
  activeRole,
  emconState,
  activeVerifications = [],
  pendingSpoofedOrder,
  onStartVerification,
  onRespondSpoofedOrder,
}) => {
  const [selectedDomain, setSelectedDomain] = useState<TacticalDomain | 'ALL'>('ALL');
  const [customRadioInput, setCustomRadioInput] = useState('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  
  // Tactical Order Modal State
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [pendingActionType, setPendingActionType] = useState<TraineeDecision['actionType']>('ARTILLERY_FIRE_MISSION');
  const [orderRationale, setOrderRationale] = useState('');
  const [orderConfidence, setOrderConfidence] = useState<number>(4);

  const filteredUnits = units.filter(
    (u) => selectedDomain === 'ALL' || u.domain === selectedDomain
  );

  const handleToggleMute = () => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    audioEngine.setMuted(nextMuted);
  };

  const handlePlayChatter = (msg: RadioMessage) => {
    audioEngine.playRadioMessageBurst(msg.audioNoiseRatio);
  };

  const handleFrequencyHopToggle = () => {
    audioEngine.playFreqHopChirp();
    const isCurrentlyHopping = commsMetrics.hoppingRateHps > 0;
    onUpdateComms({
      hoppingRateHps: isCurrentlyHopping ? 0 : 1200,
      snr: isCurrentlyHopping ? Math.max(-5, commsMetrics.snr - 8) : Math.min(25, commsMetrics.snr + 14),
      packetLoss: isCurrentlyHopping ? Math.min(80, commsMetrics.packetLoss + 25) : Math.max(5, commsMetrics.packetLoss - 25),
    });
  };

  const handleEmconToggle = () => {
    audioEngine.playRadioSquelch(true);
    const nextEmcon = commsMetrics.emconLevel === 1 ? 3 : 1;
    onUpdateComms({
      emconLevel: nextEmcon,
      packetLoss: nextEmcon === 3 ? 90 : 25,
      effectiveBandwidthKbps: nextEmcon === 3 ? 0.6 : 9.6,
    });
  };

  const handleOpenOrderModal = (actionType: TraineeDecision['actionType']) => {
    setPendingActionType(actionType);
    setOrderRationale('');
    setOrderModalOpen(true);
  };

  const handleConfirmOrder = () => {
    if (!orderRationale.trim()) {
      alert('DSSC Tactical Requirement: Trainee must articulate an operational rationale before committing resources under degraded intelligence.');
      return;
    }

    if (pendingActionType === 'ARTILLERY_FIRE_MISSION') {
      audioEngine.playArtilleryFire();
    } else {
      audioEngine.playAlertKlaxon();
    }

    onExecuteDecision({
      commanderCallsign: activeRole.title,
      actionType: pendingActionType,
      targetUnitId: selectedUnit?.id,
      targetCallsign: selectedUnit?.callsign,
      targetPos: selectedUnit?.perceivedPos,
      uncertaintyAtTime: selectedUnit?.uncertaintyRadius || 500,
      rationale: orderRationale,
      confidenceLevel: orderConfidence,
    });

    setOrderModalOpen(false);
  };

  return (
    <div className="tactical-cop-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '12px',
      color: '#e0f7fa',
      fontFamily: 'Inter, sans-serif',
      fontSize: '13px',
      overflowY: 'auto',
      paddingRight: '4px'
    }}>
      {/* MUST FEATURE 1: DECEPTION ALERT BANNER (SPOOFED RADIO DIRECTIVE) */}
      {pendingSpoofedOrder && pendingSpoofedOrder.status === 'PENDING' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(45, 10, 20, 0.96), rgba(25, 8, 15, 0.96))',
          border: '2px solid #ff3344',
          borderRadius: '8px',
          padding: '12px 14px',
          boxShadow: '0 0 25px rgba(255, 51, 68, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="#ff3344" />
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#ff5252', letterSpacing: '1px' }}>
                PRIORITY DIRECTIVE: {pendingSpoofedOrder.senderCallsign}
              </span>
            </div>
            <span style={{
              fontSize: '9px',
              background: 'rgba(255, 51, 68, 0.25)',
              color: '#ff8a80',
              padding: '2px 6px',
              borderRadius: '3px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
            }}>
              AUTHENTICITY: UNVERIFIED
            </span>
          </div>

          <div style={{
            background: 'rgba(10, 5, 8, 0.85)',
            border: '1px dashed rgba(255, 51, 68, 0.5)',
            borderRadius: '4px',
            padding: '8px 10px',
            fontSize: '11.5px',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#ffebee',
            lineHeight: 1.4,
          }}>
            "{pendingSpoofedOrder.orderText}"
          </div>

          <div style={{ fontSize: '10px', color: '#ffb700' }}>
            ⚠️ DIRECTING STAFF WARNING: Adversary voice spoofing detected on Net. Challenge Shackle code before complying!
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
            <button
              onClick={() => {
                audioEngine.playAlertKlaxon();
                onRespondSpoofedOrder?.(pendingSpoofedOrder.id, 'AUTHENTICATE');
              }}
              style={{
                flex: 1.2,
                background: 'rgba(0, 229, 255, 0.25)',
                border: '1px solid #00e5ff',
                color: '#80deea',
                borderRadius: '4px',
                padding: '6px',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <UserCheck size={12} /> CHALLENGE SHACKLE (15s)
            </button>

            <button
              onClick={() => {
                audioEngine.playAlertKlaxon();
                onRespondSpoofedOrder?.(pendingSpoofedOrder.id, 'REJECT_AS_DECEPTION');
              }}
              style={{
                flex: 1,
                background: 'rgba(0, 255, 102, 0.25)',
                border: '1px solid #00ff66',
                color: '#69f0ae',
                borderRadius: '4px',
                padding: '6px',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <CheckCircle2 size={12} /> REJECT DECEPTION (+25)
            </button>

            <button
              onClick={() => {
                audioEngine.playRadioSquelch(true);
                onRespondSpoofedOrder?.(pendingSpoofedOrder.id, 'BLINDLY_OBEY');
              }}
              style={{
                flex: 0.9,
                background: 'rgba(255, 51, 68, 0.2)',
                border: '1px solid #ff3344',
                color: '#ff8a80',
                borderRadius: '4px',
                padding: '6px',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              OBEY DIRECTIVE
            </button>
          </div>
        </div>
      )}

      {/* COMMS DEGRADATION DIAGNOSTICS DECK */}
      <div style={{
        background: 'rgba(5, 16, 26, 0.9)',
        border: '1px solid rgba(0, 229, 255, 0.25)',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: 'inset 0 0 15px rgba(0, 229, 255, 0.05)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} color="#00e5ff" />
            <span style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: 700, color: '#00e5ff' }}>
              TACTICAL DATALINK & RF SPECTRUM STATUS
            </span>
          </div>

          <button
            onClick={handleToggleMute}
            style={{
              background: 'transparent',
              border: 'none',
              color: isAudioMuted ? '#ff5252' : '#80deea',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
            }}
          >
            {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {isAudioMuted ? 'RADIO MUTED' : 'RADIO LIVE'}
          </button>
        </div>

        {/* METRICS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          <div style={{ background: 'rgba(10, 25, 40, 0.7)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(0, 229, 255, 0.15)' }}>
            <div style={{ fontSize: '9px', color: '#80deea' }}>SNR (RF NOISE)</div>
            <div style={{
              fontSize: '15px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              color: commsMetrics.snr < 5 ? '#ff3344' : commsMetrics.snr < 15 ? '#ffb700' : '#00ff66'
            }}>
              {commsMetrics.snr.toFixed(1)} dB
            </div>
            <div style={{ fontSize: '8px', color: '#90a4ae' }}>
              {commsMetrics.snr < 5 ? 'CRITICAL JAMMING' : commsMetrics.snr < 15 ? 'DEGRADED' : 'NOMINAL'}
            </div>
          </div>

          <div style={{ background: 'rgba(10, 25, 40, 0.7)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(0, 229, 255, 0.15)' }}>
            <div style={{ fontSize: '9px', color: '#80deea' }}>PACKET DROP</div>
            <div style={{
              fontSize: '15px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              color: commsMetrics.packetLoss > 40 ? '#ff3344' : commsMetrics.packetLoss > 15 ? '#ffb700' : '#00ff66'
            }}>
              {commsMetrics.packetLoss}%
            </div>
            <div style={{ fontSize: '8px', color: '#90a4ae' }}>
              {commsMetrics.packetLoss > 40 ? 'SEVERE CORRUPTION' : 'BUFFER TOLERANT'}
            </div>
          </div>

          <div style={{ background: 'rgba(10, 25, 40, 0.7)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(0, 229, 255, 0.15)' }}>
            <div style={{ fontSize: '9px', color: '#80deea' }}>FEED LATENCY</div>
            <div style={{
              fontSize: '15px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              color: commsMetrics.latencyMs > 10000 ? '#ff3344' : commsMetrics.latencyMs > 3000 ? '#ffb700' : '#00e5ff'
            }}>
              {(commsMetrics.latencyMs / 1000).toFixed(1)}s LAG
            </div>
            <div style={{ fontSize: '8px', color: '#90a4ae' }}>
              {commsMetrics.latencyMs > 10000 ? 'POSITION OBSOLETE' : 'STALE TELEMETRY'}
            </div>
          </div>

          <div style={{ background: 'rgba(10, 25, 40, 0.7)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(0, 229, 255, 0.15)' }}>
            <div style={{ fontSize: '9px', color: '#80deea' }}>CRYPTO / IFF</div>
            <div style={{
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              color: commsMetrics.cryptoStatus === 'LOCKED' ? '#00ff66' : '#ffb700',
              marginTop: '3px'
            }}>
              {commsMetrics.cryptoStatus}
            </div>
            <div style={{ fontSize: '8px', color: '#90a4ae' }}>
              {commsMetrics.activeFrequencyMHz} MHz
            </div>
          </div>
        </div>

        {/* EW COUNTERMEASURES BAR */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button
            onClick={handleFrequencyHopToggle}
            style={{
              flex: 1,
              background: commsMetrics.hoppingRateHps > 0 ? 'rgba(0, 255, 102, 0.25)' : 'rgba(255, 183, 0, 0.2)',
              border: `1px solid ${commsMetrics.hoppingRateHps > 0 ? '#00ff66' : '#ffb700'}`,
              color: commsMetrics.hoppingRateHps > 0 ? '#00ff66' : '#ffb700',
              borderRadius: '4px',
              padding: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <RotateCw size={13} />
            {commsMetrics.hoppingRateHps > 0 ? 'FHSS ACTIVE (1200 h/s)' : 'ENGAGE FREQ HOPPING'}
          </button>

          <button
            onClick={handleEmconToggle}
            style={{
              flex: 1,
              background: commsMetrics.emconLevel === 3 ? 'rgba(255, 51, 68, 0.25)' : 'rgba(0, 229, 255, 0.15)',
              border: `1px solid ${commsMetrics.emconLevel === 3 ? '#ff3344' : '#00e5ff'}`,
              color: commsMetrics.emconLevel === 3 ? '#ff8a80' : '#80deea',
              borderRadius: '4px',
              padding: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Lock size={13} />
            {commsMetrics.emconLevel === 3 ? 'EMCON ALPHA (SILENCE)' : 'IMPOSE RADIO SILENCE'}
          </button>
        </div>

        {/* MUST FEATURE 3: EMCON EMISSION-CONTROL & HOSTILE DF THREAT GAUGE */}
        <div style={{
          background: 'rgba(8, 20, 32, 0.9)',
          border: `1px solid ${emconState?.counterBatteryThreatLevel === 'CRITICAL_LOCK_IMMINENT' ? '#ff3344' : emconState?.counterBatteryThreatLevel === 'ELEVATED' ? '#ffb700' : 'rgba(0, 229, 255, 0.25)'}`,
          borderRadius: '6px',
          padding: '8px 10px',
          marginTop: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={14} color="#00e5ff" />
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#00e5ff', letterSpacing: '0.8px' }}>
                EMCON EMISSION-CONTROL & HOSTILE SIGINT DF THREAT
              </span>
            </div>

            <span style={{
              fontSize: '9.5px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: '3px',
              background: emconState?.counterBatteryThreatLevel === 'CRITICAL_LOCK_IMMINENT' 
                ? 'rgba(255, 51, 68, 0.3)' 
                : emconState?.counterBatteryThreatLevel === 'ELEVATED' 
                ? 'rgba(255, 170, 0, 0.25)' 
                : 'rgba(0, 255, 102, 0.15)',
              color: emconState?.counterBatteryThreatLevel === 'CRITICAL_LOCK_IMMINENT' 
                ? '#ff3344' 
                : emconState?.counterBatteryThreatLevel === 'ELEVATED' 
                ? '#ffb700' 
                : '#00ff66',
            }}>
              {emconState?.counterBatteryThreatLevel === 'CRITICAL_LOCK_IMMINENT' ? '⚠️ ROCKET SALVO IMMINENT' : `DF THREAT: ${emconState?.counterBatteryThreatLevel || 'LOW'}`}
            </span>
          </div>

          {/* DUAL METRIC BARS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '2px' }}>
                <span style={{ color: '#80deea' }}>COMMAND POST RF EMISSION:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: (emconState?.rfSignaturePct || 18) > 70 ? '#ff3344' : '#00e5ff' }}>
                  {emconState?.rfSignaturePct || 18}%
                </span>
              </div>
              <div style={{ height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${emconState?.rfSignaturePct || 18}%`,
                  height: '100%',
                  background: (emconState?.rfSignaturePct || 18) > 70 ? '#ff3344' : (emconState?.rfSignaturePct || 18) > 40 ? '#ffb700' : '#00e5ff',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '2px' }}>
                <span style={{ color: '#80deea' }}>HOSTILE DF TRIANGULATION LOCK:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: (emconState?.adversaryDFLockPct || 0) > 60 ? '#ff3344' : '#ffb700' }}>
                  {emconState?.adversaryDFLockPct || 0}%
                </span>
              </div>
              <div style={{ height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${emconState?.adversaryDFLockPct || 0}%`,
                  height: '100%',
                  background: (emconState?.adversaryDFLockPct || 0) > 75 ? '#ff3344' : '#ffb700',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MULTI-DOMAIN ASSET INVENTORY WITH ADMIRALTY RELIABILITY SCORES */}
      <div style={{
        background: 'rgba(5, 16, 26, 0.9)',
        border: '1px solid rgba(0, 229, 255, 0.25)',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: 700, color: '#00e5ff' }}>
              OPERATIONAL ASSETS & SENSOR TRACKS
            </span>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            {(['ALL', 'LAND', 'AIR', 'CYBER', 'EW'] as const).map((dom) => (
              <button
                key={dom}
                onClick={() => setSelectedDomain(dom)}
                style={{
                  background: selectedDomain === dom ? 'rgba(0, 229, 255, 0.3)' : 'transparent',
                  border: `1px solid ${selectedDomain === dom ? '#00e5ff' : 'rgba(255, 255, 255, 0.15)'}`,
                  color: selectedDomain === dom ? '#00e5ff' : '#90a4ae',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '9px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {dom}
              </button>
            ))}
          </div>
        </div>

        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredUnits.map((u) => {
            const isSelected = u.id === selectedUnit?.id;
            const isBlu = u.affiliation === 'BLUFOR';
            return (
              <div
                key={u.id}
                onClick={() => onSelectUnit(u)}
                style={{
                  background: isSelected 
                    ? (isBlu ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 51, 68, 0.2)')
                    : 'rgba(10, 25, 40, 0.6)',
                  border: `1px solid ${isSelected ? (isBlu ? '#00e5ff' : '#ff3344') : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '6px',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isBlu ? '#00e5ff' : u.isGhostContact ? '#d500f9' : '#ff3344'
                    }} />
                    <span style={{ fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', fontSize: '13px' }}>
                      {u.callsign}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {/* ADMIRALTY RELIABILITY BADGE */}
                    {u.admiralty && (
                      <span
                        title={`NATO Admiralty System: Reliability ${u.admiralty.reliability}, Credibility ${u.admiralty.credibility} (${u.admiralty.source})`}
                        style={{
                          fontSize: '9px',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: u.admiralty.reliability === 'A' ? 'rgba(0, 255, 102, 0.15)' : u.admiralty.reliability === 'B' ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 183, 0, 0.2)',
                          color: u.admiralty.reliability === 'A' ? '#00ff66' : u.admiralty.reliability === 'B' ? '#00e5ff' : '#ffb700',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                        }}
                      >
                        [{u.admiralty.reliability}{u.admiralty.credibility}]
                      </span>
                    )}

                    <span style={{
                      fontSize: '9px',
                      padding: '2px 5px',
                      borderRadius: '3px',
                      background: u.status === 'OPTIMAL' ? 'rgba(0, 255, 102, 0.15)' : 'rgba(255, 183, 0, 0.2)',
                      color: u.status === 'OPTIMAL' ? '#00ff66' : '#ffb700',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>
                      {u.status}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#90a4ae', marginTop: '4px' }}>
                  <span>{u.type}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: u.uncertaintyRadius > 500 ? '#ffb700' : '#80deea' }}>
                    CEP: ±{u.uncertaintyRadius}m ({u.lastContactSecondsAgo}s ago)
                  </span>
                </div>

                {u.isContradictory && (
                  <div style={{
                    marginTop: '6px',
                    background: 'rgba(255, 170, 0, 0.15)',
                    border: '1px dashed #ffaa00',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    fontSize: '9px',
                    color: '#ffe082',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <AlertTriangle size={12} color="#ffaa00" />
                    <span>INTELLIGENCE DISCREPANCY: {u.contradictoryDetail}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SELECTED ASSET INSPECTION & COMMAND ACTIONS */}
      {selectedUnit && (
        <div style={{
          background: 'rgba(5, 16, 26, 0.95)',
          border: '1px solid #00e5ff',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 0 15px rgba(0, 229, 255, 0.1)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#00e5ff', fontWeight: 700 }}>SELECTED UNIT / SENSOR TARGET</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', fontFamily: 'Rajdhani, sans-serif' }}>
                {selectedUnit.name} [{selectedUnit.domain}]
              </div>
            </div>

            <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#80deea' }}>
              GRID: {selectedUnit.perceivedPos.gridRef}
            </div>
          </div>

          {/* INFORMATION SOURCE RELIABILITY SCORE */}
          {selectedUnit.admiralty && (
            <div style={{
              background: 'rgba(10, 25, 40, 0.8)',
              border: '1px solid rgba(0, 229, 255, 0.15)',
              borderRadius: '4px',
              padding: '6px 8px',
              fontSize: '10.5px',
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <span style={{ color: '#90a4ae' }}>INTEL SOURCE: </span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{selectedUnit.admiralty.source}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
                <span style={{ color: '#00e5ff' }}>GRADE: [{selectedUnit.admiralty.reliability}{selectedUnit.admiralty.credibility}]</span>
                <span style={{ color: '#ffb700' }}>AGE: {selectedUnit.admiralty.ageSec}s</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
            <button
              onClick={() => handleOpenOrderModal('ARTILLERY_FIRE_MISSION')}
              style={{
                background: 'rgba(255, 51, 68, 0.2)',
                border: '1px solid #ff3344',
                color: '#ff8a80',
                borderRadius: '4px',
                padding: '8px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'center',
              }}
            >
              <Crosshair size={14} /> ORDER ARTILLERY STRIKE
            </button>

            <button
              onClick={() => handleOpenOrderModal('SCRAMBLE_AIR_SUPPORT')}
              style={{
                background: 'rgba(0, 229, 255, 0.2)',
                border: '1px solid #00e5ff',
                color: '#80deea',
                borderRadius: '4px',
                padding: '8px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'center',
              }}
            >
              <Send size={14} /> DISPATCH AIR SUPPORT (CAS)
            </button>

            <button
              onClick={() => handleOpenOrderModal('DISPATCH_RECCE_DRONE')}
              style={{
                background: 'rgba(0, 255, 102, 0.2)',
                border: '1px solid #00ff66',
                color: '#b9f6ca',
                borderRadius: '4px',
                padding: '8px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'center',
              }}
            >
              <Eye size={14} /> TASK RECCE VERIFICATION
            </button>

            <button
              onClick={() => handleOpenOrderModal('CHALLENGE_IFF_KEY')}
              style={{
                background: 'rgba(255, 183, 0, 0.2)',
                border: '1px solid #ffb700',
                color: '#ffe082',
                borderRadius: '4px',
                padding: '8px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'center',
              }}
            >
              <Cpu size={14} /> CHALLENGE IFF & CRYPTO
            </button>
          </div>

          {/* MUST FEATURE 2: VERIFICATION & COMPENSATION ACTION DOCK (NAVY STUDY METRIC) */}
          <div style={{
            marginTop: '10px',
            background: 'rgba(10, 25, 45, 0.75)',
            border: '1px solid rgba(0, 229, 255, 0.3)',
            borderRadius: '6px',
            padding: '8px 10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <UserCheck size={13} color="#00e5ff" />
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#00e5ff', letterSpacing: '0.8px' }}>
                  VERIFICATION & COMPENSATION DOCK (TIME-COST ACTIONS)
                </span>
              </div>
              <span style={{ fontSize: '9px', color: '#80deea' }}>ZERO MUNITION COST</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button
                onClick={() => {
                  audioEngine.playFreqHopChirp();
                  onStartVerification?.('DISPATCH_PHYSICAL_RUNNER', selectedUnit.id, `Dispatch Runner to ${selectedUnit.callsign}`, 45);
                }}
                style={{
                  background: 'rgba(0, 229, 255, 0.12)',
                  border: '1px solid rgba(0, 229, 255, 0.4)',
                  borderRadius: '4px',
                  padding: '6px 4px',
                  color: '#80deea',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <Footprints size={14} color="#00e5ff" />
                <span>PHYSICAL RUNNER</span>
                <span style={{ fontSize: '8.5px', color: '#00ff66' }}>45s • 0 RF (Jam-Proof)</span>
              </button>

              <button
                onClick={() => {
                  audioEngine.playFreqHopChirp();
                  onStartVerification?.('CROSS_CHECK_OPTICAL_UAV', selectedUnit.id, `Optical UAV sweep of ${selectedUnit.callsign}`, 20);
                }}
                style={{
                  background: 'rgba(0, 255, 102, 0.12)',
                  border: '1px solid rgba(0, 255, 102, 0.4)',
                  borderRadius: '4px',
                  padding: '6px 4px',
                  color: '#b9f6ca',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <Eye size={14} color="#00ff66" />
                <span>OPTICAL UAV</span>
                <span style={{ fontSize: '8.5px', color: '#69f0ae' }}>20s • Ground Truth Fix</span>
              </button>

              <button
                onClick={() => {
                  audioEngine.playAlertKlaxon();
                  onStartVerification?.('CHALLENGE_AUTHENTICATE', selectedUnit.id, `Shackle Key Challenge to ${selectedUnit.callsign}`, 15);
                }}
                style={{
                  background: 'rgba(255, 183, 0, 0.12)',
                  border: '1px solid rgba(255, 183, 0, 0.4)',
                  borderRadius: '4px',
                  padding: '6px 4px',
                  color: '#ffe082',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <UserCheck size={14} color="#ffb700" />
                <span>SHACKLE / IFF</span>
                <span style={{ fontSize: '8.5px', color: '#ffb700' }}>15s • Deception Check</span>
              </button>
            </div>

            {/* IN-FLIGHT VERIFICATIONS COUNTDOWN CARDS */}
            {activeVerifications.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '9px', color: '#90a4ae', fontWeight: 600 }}>IN-PROGRESS COMPENSATION ACTIONS:</div>
                {activeVerifications.map((v) => (
                  <div key={v.id} style={{
                    background: 'rgba(5, 15, 25, 0.85)',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    borderRadius: '4px',
                    padding: '5px 8px',
                    fontSize: '10px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={11} color="#00e5ff" />
                        <span style={{ color: '#fff', fontWeight: 600 }}>{v.label}</span>
                      </div>
                      <span style={{ color: '#00e5ff', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                        {v.remainingSec > 0 ? `${v.remainingSec}s REMAINING` : 'COMPLETE'}
                      </span>
                    </div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.round(((v.durationSec - v.remainingSec) / v.durationSec) * 100)}%`,
                        height: '100%',
                        background: '#00e5ff',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMBAT NET RADIO TRANSCRIPT */}
      <div style={{
        background: 'rgba(5, 16, 26, 0.9)',
        border: '1px solid rgba(0, 229, 255, 0.25)',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flex: 1,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={15} color="#00e5ff" />
            <span style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: 700, color: '#00e5ff' }}>
              COMBAT NET RADIO (VHF / SECURE SATCOM)
            </span>
          </div>
          <span style={{ fontSize: '9px', color: '#90a4ae' }}>CH-04 PRIORITY</span>
        </div>

        <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {radioChatter.map((msg) => (
            <div
              key={msg.id}
              style={{
                background: 'rgba(10, 25, 40, 0.7)',
                borderLeft: `3px solid ${msg.priority === 'FLASH' ? '#ff3344' : msg.priority === 'PRIORITY' ? '#ffb700' : '#00e5ff'}`,
                padding: '6px 8px',
                borderRadius: '0 4px 4px 0',
                fontSize: '11px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontWeight: 700, color: '#80deea', fontFamily: 'Rajdhani, sans-serif' }}>
                  {msg.senderCallsign}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '9px', color: '#78909c', fontFamily: 'JetBrains Mono, monospace' }}>
                    {msg.timestamp}
                  </span>
                  <button
                    onClick={() => handlePlayChatter(msg)}
                    title="Play Audio Chatter with Static"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#00e5ff',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <Volume2 size={12} />
                  </button>
                </div>
              </div>

              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10.5px',
                color: msg.isContradictory ? '#ffcc80' : '#eceff1',
                lineHeight: 1.4,
              }}>
                {commsMetrics.snr < 10 && msg.corruptedText ? msg.corruptedText : msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* TRANSMIT MESSAGE INPUT */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          <input
            type="text"
            placeholder="Transmit tactical query / sitrep..."
            value={customRadioInput}
            onChange={(e) => setCustomRadioInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customRadioInput.trim()) {
                onSendRadioMessage(customRadioInput);
                setCustomRadioInput('');
              }
            }}
            style={{
              flex: 1,
              background: 'rgba(10, 25, 40, 0.8)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              borderRadius: '4px',
              padding: '6px 10px',
              color: '#e0f7fa',
              fontSize: '11px',
              outline: 'none',
            }}
          />
          <button
            onClick={() => {
              if (customRadioInput.trim()) {
                onSendRadioMessage(customRadioInput);
                setCustomRadioInput('');
              }
            }}
            style={{
              background: 'rgba(0, 229, 255, 0.25)',
              border: '1px solid #00e5ff',
              color: '#00e5ff',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            TX
          </button>
        </div>
      </div>

      {/* MANDATORY COMMAND RATIONALE & CONFIDENCE MODAL */}
      {orderModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#071626',
            border: '2px solid #00e5ff',
            borderRadius: '8px',
            padding: '24px',
            width: '520px',
            maxWidth: '90vw',
            color: '#e0f7fa',
            boxShadow: '0 0 40px rgba(0, 229, 255, 0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Shield size={24} color="#00e5ff" />
              <div>
                <div style={{ fontSize: '11px', color: '#00e5ff', fontWeight: 700, letterSpacing: '1.5px' }}>
                  DEFENCE SERVICES STAFF COLLEGE • TACTICAL DECISION LOG
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Rajdhani, sans-serif' }}>
                  COMMAND EXECUTION UNDER DEGRADED COMMS
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(10, 25, 40, 0.8)', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#80deea', marginBottom: '4px' }}>ACTION SUMMARY:</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                {pendingActionType.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '12px', color: '#90a4ae', marginTop: '2px' }}>
                TARGET: {selectedUnit ? `${selectedUnit.callsign} (${selectedUnit.type})` : 'SECTOR DEFENSE'}
              </div>
              <div style={{ fontSize: '11px', color: '#ffb700', marginTop: '4px' }}>
                CURRENT UNCERTAINTY: ±{selectedUnit?.uncertaintyRadius || 500}m CEP | LATENCY: {(commsMetrics.latencyMs / 1000).toFixed(1)}s
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#80deea', marginBottom: '6px' }}>
                MANDATORY COMMANDER RATIONALE (Why this decision despite incomplete/contradictory feeds?):
              </label>
              <textarea
                rows={4}
                value={orderRationale}
                onChange={(e) => setOrderRationale(e.target.value)}
                placeholder="E.g., Target speed and heading indicate an attempt to seize Point 5140 before daylight. Delayed UAV feed confirms dust plumes consistent with armor. Delaying artillery will result in friendly forward post overrun..."
                style={{
                  width: '100%',
                  background: 'rgba(5, 15, 25, 0.9)',
                  border: '1px solid rgba(0, 229, 255, 0.4)',
                  borderRadius: '4px',
                  padding: '10px',
                  color: '#fff',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#80deea', marginBottom: '6px' }}>
                <span>TAG YOUR CONFIDENCE LEVEL (Feeds into DSSC Calibration Index):</span>
                <span style={{ fontWeight: 700, color: '#00e5ff' }}>{orderConfidence} / 5</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={orderConfidence}
                onChange={(e) => setOrderConfidence(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#00e5ff' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#78909c' }}>
                <span>1 - Speculative Guess</span>
                <span>3 - Calculated Risk</span>
                <span>5 - Absolute Certainty</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOrderModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#90a4ae',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmOrder}
                style={{
                  background: '#00e5ff',
                  border: 'none',
                  color: '#040d1a',
                  borderRadius: '4px',
                  padding: '8px 20px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  letterSpacing: '1px',
                }}
              >
                AUTHENTICATE & COMMIT ORDER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
