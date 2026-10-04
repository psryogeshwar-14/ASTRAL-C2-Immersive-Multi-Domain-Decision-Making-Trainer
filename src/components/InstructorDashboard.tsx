import React from 'react';
import type { 
  CommsMetrics, 
  TraineeDecision 
} from '../types/tactical';
import { audioEngine } from '../services/audioEngine';
import { 
  ShieldAlert, 
  Sliders, 
  WifiOff, 
  Eye, 
  AlertTriangle, 
  Activity, 
  FileCheck,
  RotateCcw,
  Sparkles,
  Zap
} from 'lucide-react';

interface InstructorDashboardProps {
  commsMetrics: CommsMetrics;
  onUpdateComms: (metrics: Partial<CommsMetrics>) => void;
  ewJammingIntensity: number;
  onUpdateEWIntensity: (val: number) => void;
  showGroundTruth: boolean;
  onToggleGroundTruth: () => void;
  decisions: TraineeDecision[];
  onInjectEvent: (type: 'GHOST_DRONE' | 'RADIO_DROPOUT' | 'CONTRADICTORY_FEED' | 'IONO_BLIZZARD' | 'EW_BARRAGE_PRESET' | 'GPS_SPOOF_PRESET' | 'VALLEY_BLACKOUT_PRESET' | 'SPOOFED_RETREAT_ORDER') => void;
  onOpenAAR: () => void;
  exerciseTimeSec: number;
  onResetExercise: () => void;
}

export const InstructorDashboard: React.FC<InstructorDashboardProps> = ({
  commsMetrics,
  onUpdateComms,
  ewJammingIntensity,
  onUpdateEWIntensity,
  showGroundTruth,
  onToggleGroundTruth,
  decisions,
  onInjectEvent,
  onOpenAAR,
  exerciseTimeSec,
  onResetExercise
}) => {
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDecisions = decisions.length;
  const accurateStrikes = decisions.filter(d => d.evaluatedEffect === 'ACCURATE_STRIKE' || d.evaluatedEffect === 'EFFECTIVE_COUNTERMEASURE').length;
  const criticalErrors = decisions.filter(d => d.evaluatedEffect === 'FRIENDLY_FIRE_RISK' || d.evaluatedEffect === 'MISSED_GHOST').length;
  const doctrineScore = Math.max(20, Math.min(100, Math.round(75 + accurateStrikes * 10 - criticalErrors * 18)));

  const applyPreset = (preset: 'EW_BARRAGE' | 'GPS_SPOOF' | 'VALLEY_BLACKOUT' | 'CONTRADICTORY_INTEL') => {
    if (preset === 'EW_BARRAGE') {
      audioEngine.playRadioMessageBurst(0.85);
      onUpdateEWIntensity(80);
      onUpdateComms({
        snr: -4.5,
        packetLoss: 65,
        latencyMs: 18000,
        cryptoStatus: 'DEGRADED',
      });
      onInjectEvent('EW_BARRAGE_PRESET');
    } else if (preset === 'GPS_SPOOF') {
      audioEngine.playAlertKlaxon();
      onUpdateComms({
        latencyMs: 14000,
        cryptoStatus: 'COMPROMISED',
      });
      onInjectEvent('GPS_SPOOF_PRESET');
    } else if (preset === 'VALLEY_BLACKOUT') {
      audioEngine.playRadioSquelch(true);
      onUpdateComms({
        packetLoss: 85,
        snr: -8.0,
        latencyMs: 25000,
      });
      onInjectEvent('VALLEY_BLACKOUT_PRESET');
    } else if (preset === 'CONTRADICTORY_INTEL') {
      audioEngine.playFreqHopChirp();
      onInjectEvent('CONTRADICTORY_FEED');
    }
  };

  return (
    <div className="instructor-dashboard-panel" style={{
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
      {/* HEADER / EXERCISE STATUS */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 10, 15, 0.95), rgba(15, 20, 30, 0.95))',
        border: '1px solid #ff3344',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 0 20px rgba(255, 51, 68, 0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} color="#ff3344" />
            <div>
              <div style={{ fontSize: '10px', color: '#ff8a80', fontWeight: 700, letterSpacing: '1.5px' }}>
                WHITE CELL EXERCISE DIRECTING STAFF (DSSC)
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'Rajdhani, sans-serif' }}>
                INSTRUCTOR LIVE CONTROL & TELEMETRY CONSOLE
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '9px', color: '#90a4ae' }}>ELAPSED T-TIME</div>
            <div style={{ fontSize: '16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#ff5252' }}>
              T+{formatTime(exerciseTimeSec)}
            </div>
          </div>
        </div>

        {/* GROUND TRUTH TOGGLE BUTTON */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <button
            onClick={onToggleGroundTruth}
            style={{
              flex: 1,
              background: showGroundTruth ? 'rgba(255, 51, 68, 0.3)' : 'rgba(10, 25, 40, 0.7)',
              border: `1px solid ${showGroundTruth ? '#ff3344' : 'rgba(255, 255, 255, 0.2)'}`,
              color: showGroundTruth ? '#ff8a80' : '#cfd8dc',
              borderRadius: '4px',
              padding: '8px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Eye size={14} />
            {showGroundTruth ? 'GROUND TRUTH REALITY: ON' : 'SWITCH TO GROUND TRUTH (GOD VIEW)'}
          </button>

          <button
            onClick={onOpenAAR}
            style={{
              background: 'linear-gradient(90deg, #00e5ff, #00b0ff)',
              border: 'none',
              color: '#040d1a',
              borderRadius: '4px',
              padding: '8px 16px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              letterSpacing: '0.8px',
            }}
          >
            <FileCheck size={14} /> GENERATE AAR DEBRIEF
          </button>

          <button
            onClick={onResetExercise}
            title="Reset Scenario"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#cfd8dc',
              borderRadius: '4px',
              padding: '8px',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* ONE-CLICK DEGRADATION PRESETS (RECOMMENDED BY DOCTRINE STRATEGY) */}
      <div style={{
        background: 'rgba(5, 16, 26, 0.9)',
        border: '1px solid rgba(255, 183, 0, 0.35)',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={15} color="#ffb700" />
          <span style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: 800, color: '#ffb700' }}>
            ONE-CLICK DEGRADATION PRESETS
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          <button
            onClick={() => applyPreset('EW_BARRAGE')}
            style={{
              background: 'rgba(255, 51, 68, 0.18)',
              border: '1px solid #ff3344',
              color: '#ff8a80',
              borderRadius: '4px',
              padding: '7px 8px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Zap size={12} /> EW BARRAGE ON NET ALPHA
          </button>

          <button
            onClick={() => applyPreset('GPS_SPOOF')}
            style={{
              background: 'rgba(213, 0, 249, 0.18)',
              border: '1px solid #d500f9',
              color: '#ea80fc',
              borderRadius: '4px',
              padding: '7px 8px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Sparkles size={12} /> GPS SPOOF & MEACONING
          </button>

          <button
            onClick={() => applyPreset('VALLEY_BLACKOUT')}
            style={{
              background: 'rgba(255, 145, 0, 0.18)',
              border: '1px solid #ff9100',
              color: '#ffe082',
              borderRadius: '4px',
              padding: '7px 8px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <WifiOff size={12} /> VALLEY COMMS BLACKOUT
          </button>

          <button
            onClick={() => applyPreset('CONTRADICTORY_INTEL')}
            style={{
              background: 'rgba(0, 229, 255, 0.18)',
              border: '1px solid #00e5ff',
              color: '#80deea',
              borderRadius: '4px',
              padding: '7px 8px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <AlertTriangle size={12} /> CONFLICTING INTEL FEEDS
          </button>
        </div>
      </div>

      {/* DISRUPTION INJECTOR CONTROLS */}
      <div style={{
        background: 'rgba(5, 16, 26, 0.9)',
        border: '1px solid rgba(0, 229, 255, 0.25)',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sliders size={16} color="#00e5ff" />
          <span style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: 700, color: '#00e5ff' }}>
            MANUAL DISRUPTION DIALS
          </span>
        </div>

        {/* EW JAMMING SLIDER */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#80deea' }}>KRASUKHA-4 EW JAMMER RADIATED POWER:</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#ff3344' }}>
              {ewJammingIntensity} kW ({ewJammingIntensity > 60 ? 'BARRAGE NOISE' : ewJammingIntensity > 0 ? 'SPOT JAMMING' : 'OFFLINE'})
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={ewJammingIntensity}
            onChange={(e) => {
              const val = Number(e.target.value);
              onUpdateEWIntensity(val);
              const newSnr = Math.max(-10, 24 - (val / 100) * 32);
              const newPacketLoss = Math.min(90, Math.round(5 + (val / 100) * 75));
              onUpdateComms({
                snr: newSnr,
                packetLoss: newPacketLoss,
              });
            }}
            style={{ width: '100%', accentColor: '#ff3344' }}
          />
        </div>

        {/* LATENCY SLIDER */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#80deea' }}>C2 NETWORK TELEMETRY DELAY (LATENCY):</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#ffb700' }}>
              {(commsMetrics.latencyMs / 1000).toFixed(1)} SECONDS
            </span>
          </div>
          <input
            type="range"
            min={500}
            max={35000}
            step={500}
            value={commsMetrics.latencyMs}
            onChange={(e) => onUpdateComms({ latencyMs: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#ffb700' }}
          />
        </div>

        {/* PACKET LOSS SLIDER */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#80deea' }}>PACKET DROP RATE (COMMUNICATION DROPOUTS):</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#ff5252' }}>
              {commsMetrics.packetLoss}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            value={commsMetrics.packetLoss}
            onChange={(e) => onUpdateComms({ packetLoss: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#ff5252' }}
          />
        </div>

        {/* RAPID TACTICAL INJECTION BUTTONS */}
        <div style={{ fontSize: '10px', color: '#90a4ae', fontWeight: 600, marginTop: '2px' }}>
          SPECIAL EVENTS:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          <button
            onClick={() => {
              audioEngine.playAlertKlaxon();
              onInjectEvent('GHOST_DRONE');
            }}
            style={{
              background: 'rgba(213, 0, 249, 0.15)',
              border: '1px solid #d500f9',
              color: '#ea80fc',
              borderRadius: '4px',
              padding: '6px 8px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={13} /> INJECT PHANTOM DRONE
          </button>

          <button
            onClick={() => {
              audioEngine.playRadioSquelch(true);
              onInjectEvent('RADIO_DROPOUT');
            }}
            style={{
              background: 'rgba(255, 51, 68, 0.15)',
              border: '1px solid #ff3344',
              color: '#ff8a80',
              borderRadius: '4px',
              padding: '6px 8px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <WifiOff size={13} /> SEVER CHARLIE COY RADIO
          </button>

          <button
            onClick={() => {
              audioEngine.playFreqHopChirp();
              onInjectEvent('CONTRADICTORY_FEED');
            }}
            style={{
              background: 'rgba(255, 170, 0, 0.15)',
              border: '1px solid #ffaa00',
              color: '#ffe082',
              borderRadius: '4px',
              padding: '6px 8px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertTriangle size={13} /> INJECT CONTRADICTORY REPORT
          </button>

          <button
            onClick={() => onInjectEvent('IONO_BLIZZARD')}
            style={{
              background: 'rgba(0, 229, 255, 0.15)',
              border: '1px solid #00e5ff',
              color: '#80deea',
              borderRadius: '4px',
              padding: '6px 8px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={13} /> TRIGGER BLIZZARD ATTENUATION
          </button>

          <button
            onClick={() => {
              audioEngine.playAlertKlaxon();
              onInjectEvent('SPOOFED_RETREAT_ORDER');
            }}
            style={{
              gridColumn: 'span 2',
              background: 'rgba(255, 51, 68, 0.25)',
              border: '1px solid #ff3344',
              color: '#ff8a80',
              borderRadius: '4px',
              padding: '7px 8px',
              fontSize: '10.5px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <ShieldAlert size={14} /> INJECT SPOOFED RETREAT DIRECTIVE (DECEPTION)
          </button>
        </div>
      </div>

      {/* REAL-TIME TRAINEE PERFORMANCE TELEMETRY */}
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
          <span style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: 700, color: '#00e5ff' }}>
            TRAINEE DECISION AUDIT & DOCTRINE SCORE
          </span>
          <span style={{
            fontSize: '13px',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            color: doctrineScore >= 75 ? '#00ff66' : doctrineScore >= 50 ? '#ffb700' : '#ff3344'
          }}>
            SCORE: {doctrineScore}/100
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          <div style={{ background: 'rgba(10, 25, 40, 0.7)', padding: '6px', borderRadius: '4px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#90a4ae' }}>ORDERS GIVEN</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{totalDecisions}</div>
          </div>
          <div style={{ background: 'rgba(10, 25, 40, 0.7)', padding: '6px', borderRadius: '4px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#00ff66' }}>SOUND DECISIONS</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#00ff66' }}>{accurateStrikes}</div>
          </div>
          <div style={{ background: 'rgba(10, 25, 40, 0.7)', padding: '6px', borderRadius: '4px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#ff3344' }}>CRITICAL RISKS</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#ff3344' }}>{criticalErrors}</div>
          </div>
        </div>

        <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
          {decisions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', color: '#78909c', fontSize: '11px' }}>
              No trainee tactical orders recorded yet. As trainees authorize fire missions or countermeasures, live rationale will stream here.
            </div>
          ) : (
            decisions.map((d) => (
              <div
                key={d.id}
                style={{
                  background: 'rgba(10, 25, 40, 0.7)',
                  borderLeft: `3px solid ${
                    d.evaluatedEffect === 'ACCURATE_STRIKE' ? '#00ff66' :
                    d.evaluatedEffect === 'FRIENDLY_FIRE_RISK' ? '#ff3344' :
                    d.evaluatedEffect === 'MISSED_GHOST' ? '#d500f9' : '#ffb700'
                  }`,
                  padding: '6px 8px',
                  borderRadius: '0 4px 4px 0',
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#fff', fontFamily: 'Rajdhani, sans-serif' }}>
                    {d.actionType.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: '9px', color: '#90a4ae', fontFamily: 'JetBrains Mono, monospace' }}>
                    T+{formatTime(d.exerciseElapsedSec)}
                  </span>
                </div>

                <div style={{ fontSize: '10px', color: '#80deea', marginTop: '2px' }}>
                  RATIONALE: "{d.rationale}"
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px', fontSize: '9px' }}>
                  <span style={{ color: '#ffd54f' }}>Confidence: {d.confidenceLevel}/5</span>
                  <span style={{
                    fontWeight: 700,
                    color: d.evaluatedEffect === 'ACCURATE_STRIKE' ? '#00ff66' : '#ff8a80'
                  }}>
                    {d.feedback}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
