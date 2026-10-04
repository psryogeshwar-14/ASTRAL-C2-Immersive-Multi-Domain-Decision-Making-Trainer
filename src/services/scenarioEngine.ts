import type { 
  TacticalUnit, 
  CommsMetrics, 
  RadioMessage, 
  ScenarioDefinition,
  TraineeRole 
} from '../types/tactical';

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'TRISHUL_PEAK',
    title: 'Operation Trishul Ridge: High-Altitude Hybrid Defense',
    theater: 'Eastern Ladakh / Karakoram Northern Sector',
    elevation: '4,650m - 5,420m AMSL',
    threatLevel: 'DEFCON 1',
    weather: 'Clear Altitude',
    briefing: 'Adversary has initiated multi-axis probes supported by high-power mobile EW barrage jammers and cyber disruption against automated datalinks. Forward sub-units are experiencing communication blackouts and sensor ghosting in mountain radar shadows. Sub-unit commanders must evaluate contradictory intelligence, neutralize infiltrating mechanized probes, and avoid friendly fire amidst degraded C2.',
    instructorInjectDefaults: {
      ewJammerPowerKw: 45,
      packetLossPct: 35,
      latencySec: 12,
      enableSpoofing: true,
      weatherPenalty: 10,
    }
  },
  {
    id: 'SIACHEN_GLACIAL',
    title: 'Operation Glacier Shield: Extreme Weather EW Incursion',
    theater: 'Saltoro Ridge / Glacial Saddle Corridor',
    elevation: '5,800m - 6,300m AMSL',
    threatLevel: 'DEFCON 2',
    weather: 'Mountain Blizzard',
    briefing: 'A Category-4 Himalayan blizzard combined with hostile spot-jamming has crippled VHF tactical repeaters. Forward Observation Posts (OPs) are isolated under EMCON Alpha. Acoustic and thermal drone swarms are reported on conflicting bearings.',
    instructorInjectDefaults: {
      ewJammerPowerKw: 70,
      packetLossPct: 60,
      latencySec: 25,
      enableSpoofing: true,
      weatherPenalty: 40,
    }
  },
  {
    id: 'SHYOK_CONVOY',
    title: 'Operation Shyok Pinch: Datalink Cyber Hijack & Ambush',
    theater: 'Shyok River Defile & Chushul Axis',
    elevation: '4,200m - 4,900m AMSL',
    threatLevel: 'DEFCON 1',
    weather: 'Severe Ionospheric Fog',
    briefing: 'Adversary state-sponsored cyber units have compromised secondary GPS repeaters, injecting false telemetry into Blue Force Tracker (BFT) screens. Trainees must cross-examine physical terrain line-of-sight against digital overlays to identify spoofed targets.',
    instructorInjectDefaults: {
      ewJammerPowerKw: 30,
      packetLossPct: 20,
      latencySec: 8,
      enableSpoofing: true,
      weatherPenalty: 25,
    }
  }
];

export const TRAINEE_ROLES: TraineeRole[] = [
  {
    id: 'SUB_UNIT_CDR',
    title: 'Sub-Unit Commander',
    rank: 'Major / Company Commander',
    responsibilities: 'Direct tactical ground operations, assign fire missions, preserve combat power, authorize kinetic strikes under degraded feeds.',
    badgeColor: '#00ff66'
  },
  {
    id: 'AIR_CONTROLLER',
    title: 'Joint Terminal Air Controller (JTAC)',
    rank: 'Squadron Leader / Air Liaison',
    responsibilities: 'Coordinate close air support (CAS), UAV ISR orbits, air defense deconfliction, verify visual targets vs corrupted radar bogeys.',
    badgeColor: '#00e5ff'
  },
  {
    id: 'EW_CYBER_OFFICER',
    title: 'Signals & EW Defence Officer',
    rank: 'Captain / EW Battalion',
    responsibilities: 'Detect enemy jammer azimuths, execute dynamic frequency hopping (FHSS), re-seed compromised crypto keys, manage EMCON status.',
    badgeColor: '#ffb700'
  },
  {
    id: 'INSTRUCTOR_WHITE_CELL',
    title: 'White Cell Controller (Instructor)',
    rank: 'Colonel / DSSC Directing Staff',
    responsibilities: 'Exercise master oversight, ground-truth view, live disruption injection, trainee stress tracking, generate AAR grading.',
    badgeColor: '#ff3344'
  }
];

export function getInitialUnits(): TacticalUnit[] {
  return [
    // BLUFOR LAND
    {
      id: 'BLU-CHARLIE',
      callsign: 'CHARLIE-6 (4 RAJ RIF)',
      name: 'Charlie Company (Infantry HQ)',
      domain: 'LAND',
      affiliation: 'BLUFOR',
      type: 'Mountain Infantry Sub-unit',
      groundTruthPos: { x: -25, y: 14.5, z: 10, gridRef: '43X MH 7412 8821' },
      perceivedPos: { x: -25, y: 14.5, z: 10, gridRef: '43X MH 7412 8821' },
      altitude: 4850,
      heading: 45,
      speed: 4,
      status: 'ENGAGED',
      health: 88,
      ammo: 75,
      commsQuality: 62,
      uncertaintyRadius: 350,
      lastContactSecondsAgo: 8,
      admiralty: {
        reliability: 'A',
        credibility: 1,
        source: 'Organic Combat Net Radio (Direct VHF)',
        ageSec: 8,
      }
    },
    {
      id: 'BLU-ALPHA-RECCE',
      callsign: 'ALPHA-PATROL (RECCE)',
      name: 'Alpha Reconnaissance Patrol',
      domain: 'LAND',
      affiliation: 'BLUFOR',
      type: 'Scout Snipers & Special Recce',
      groundTruthPos: { x: 5, y: 18.2, z: -15, gridRef: '43X MH 8190 9410' },
      perceivedPos: { x: 4, y: 18.2, z: -16, gridRef: '43X MH 8180 9400' },
      altitude: 5120,
      heading: 15,
      speed: 3,
      status: 'DEGRADED',
      health: 95,
      ammo: 90,
      commsQuality: 35,
      uncertaintyRadius: 850,
      lastContactSecondsAgo: 42,
      admiralty: {
        reliability: 'B',
        credibility: 2,
        source: 'Forward Observation Post Runner',
        ageSec: 42,
      },
      contradictoryDetail: 'Radio report states OPFOR column halted in gorge, but satellite datalink shows active movement.'
    },
    {
      id: 'BLU-ARTILLERY',
      callsign: 'DHANUSH-BATTERY',
      name: '155mm Dhanush Howitzer Battery',
      domain: 'LAND',
      affiliation: 'BLUFOR',
      type: 'Heavy Artillery Fire Base',
      groundTruthPos: { x: -60, y: 8.5, z: 45, gridRef: '43X MH 6120 7215' },
      perceivedPos: { x: -60, y: 8.5, z: 45, gridRef: '43X MH 6120 7215' },
      altitude: 3950,
      heading: 0,
      speed: 0,
      status: 'OPTIMAL',
      health: 100,
      ammo: 82,
      commsQuality: 95,
      uncertaintyRadius: 50,
      lastContactSecondsAgo: 2,
      admiralty: {
        reliability: 'A',
        credibility: 1,
        source: 'Hardwired Landline C2 Cable',
        ageSec: 2,
      }
    },
    // BLUFOR AIR
    {
      id: 'BLU-HERON-UAV',
      callsign: 'NETRA-2 (HERON TP)',
      name: 'Heron TP Surveillance Drone',
      domain: 'AIR',
      affiliation: 'BLUFOR',
      type: 'MALE High-Altitude Recon UAV',
      groundTruthPos: { x: -10, y: 35.0, z: -5, gridRef: '43X MH 7850 9100' },
      perceivedPos: { x: -8, y: 35.0, z: -3, gridRef: '43X MH 7860 9110' },
      altitude: 8200,
      heading: 220,
      speed: 180,
      status: 'DEGRADED',
      health: 100,
      ammo: 100,
      commsQuality: 48,
      uncertaintyRadius: 400,
      lastContactSecondsAgo: 14,
      admiralty: {
        reliability: 'B',
        credibility: 1,
        source: 'Encrypted Ku-band SATCOM Feed',
        ageSec: 14,
      }
    },
    {
      id: 'BLU-GARUDA-CAP',
      callsign: 'GARUDA-1 (SU-30MKI)',
      name: 'IAF Su-30MKI Combat Air Patrol',
      domain: 'AIR',
      affiliation: 'BLUFOR',
      type: 'Air Superiority Fighter Flight',
      groundTruthPos: { x: -45, y: 48.0, z: 20, gridRef: '43X MH 6800 7900' },
      perceivedPos: { x: -45, y: 48.0, z: 20, gridRef: '43X MH 6800 7900' },
      altitude: 10500,
      heading: 65,
      speed: 750,
      status: 'OPTIMAL',
      health: 100,
      ammo: 70,
      commsQuality: 88,
      uncertaintyRadius: 150,
      lastContactSecondsAgo: 4,
      admiralty: {
        reliability: 'A',
        credibility: 1,
        source: 'Tactical Datalink Link-16/BFT',
        ageSec: 4,
      }
    },
    // BLUFOR EW / CYBER
    {
      id: 'BLU-SAMYUKTA-EW',
      callsign: 'SAMYUKTA-7 (EW NODE)',
      name: 'Mobile Electronic Warfare & SIGINT',
      domain: 'EW',
      affiliation: 'BLUFOR',
      type: 'Integrated EW & Direction Finding',
      groundTruthPos: { x: -40, y: 16.0, z: 0, gridRef: '43X MH 6980 8450' },
      perceivedPos: { x: -40, y: 16.0, z: 0, gridRef: '43X MH 6980 8450' },
      altitude: 4720,
      heading: 90,
      speed: 0,
      status: 'OPTIMAL',
      health: 100,
      ammo: 100,
      commsQuality: 92,
      uncertaintyRadius: 80,
      lastContactSecondsAgo: 1,
      admiralty: {
        reliability: 'A',
        credibility: 1,
        source: 'Samyukta ESM Antenna Array',
        ageSec: 1,
      }
    },

    // OPFOR (HOSTILE UNITS)
    {
      id: 'OPFOR-KRASUKHA',
      callsign: 'RED-JAMMER (KRASUKHA-4)',
      name: 'High-Power Broadband Barrage Jammer',
      domain: 'EW',
      affiliation: 'OPFOR',
      type: 'Adversary Tactical EW Platform',
      groundTruthPos: { x: 50, y: 17.5, z: -35, gridRef: '43X MH 9520 9980' },
      perceivedPos: { x: 58, y: 17.5, z: -40, gridRef: '43X MH 9600 9995' },
      altitude: 4950,
      heading: 240,
      speed: 0,
      status: 'OPTIMAL',
      health: 100,
      ammo: 100,
      commsQuality: 100,
      uncertaintyRadius: 1200,
      lastContactSecondsAgo: 120,
      admiralty: {
        reliability: 'C',
        credibility: 3,
        source: 'SIGINT Direction Finding Triangulation',
        ageSec: 120,
      }
    },
    {
      id: 'OPFOR-ARMOR-COLUMN',
      callsign: 'RED-SPEAR (ARMOR RECCE)',
      name: 'Infiltrating Mechanized Platoon (ZBD-04)',
      domain: 'LAND',
      affiliation: 'OPFOR',
      type: 'Infantry Fighting Vehicles & Light Armor',
      groundTruthPos: { x: 22, y: 11.0, z: -10, gridRef: '43X MH 8650 9240' },
      perceivedPos: { x: 28, y: 11.0, z: -14, gridRef: '43X MH 8720 9280' },
      altitude: 4320,
      heading: 215,
      speed: 25,
      status: 'ENGAGED',
      health: 85,
      ammo: 90,
      commsQuality: 80,
      uncertaintyRadius: 750,
      lastContactSecondsAgo: 28,
      admiralty: {
        reliability: 'B',
        credibility: 2,
        source: 'Heron UAV FLIR Thermal Camera',
        ageSec: 28,
      }
    },
    {
      id: 'OPFOR-LOITERING-SWARM',
      callsign: 'RED-SWARM (LOITERING UAV)',
      name: 'Autonomous Attack Drone Swarm',
      domain: 'AIR',
      affiliation: 'OPFOR',
      type: 'CH-901 Loitering Munition Swarm',
      groundTruthPos: { x: 12, y: 24.0, z: 5, gridRef: '43X MH 8320 8920' },
      perceivedPos: { x: 12, y: 24.0, z: 5, gridRef: '43X MH 8320 8920' },
      altitude: 6200,
      heading: 250,
      speed: 140,
      status: 'OPTIMAL',
      health: 100,
      ammo: 100,
      commsQuality: 90,
      uncertaintyRadius: 500,
      lastContactSecondsAgo: 9,
      admiralty: {
        reliability: 'C',
        credibility: 2,
        source: 'Acoustic Signature Detection Grid',
        ageSec: 9,
      }
    },

    // GHOST CONTACT (SPOOFED BY CYBER/EW)
    {
      id: 'SPOOF-GHOST-DRONE',
      callsign: 'GHOST-ECHO (SPOOFED RADAR)',
      name: 'Deception Target (Cyber/EW Phantom)',
      domain: 'AIR',
      affiliation: 'UNKNOWN',
      type: 'False Radar Reflector / Datalink Inject',
      groundTruthPos: { x: 999, y: 0, z: 999, gridRef: 'NON-EXISTENT' },
      perceivedPos: { x: -18, y: 28.0, z: 25, gridRef: '43X MH 7520 8210' },
      altitude: 6800,
      heading: 310,
      speed: 280,
      status: 'OPTIMAL',
      health: 100,
      ammo: 0,
      commsQuality: 10,
      uncertaintyRadius: 1600,
      lastContactSecondsAgo: 5,
      isGhostContact: true,
      isContradictory: true,
      contradictoryDetail: 'Air defense radar paints target, but optical payload on Heron UAV confirms clear skies at coordinates.',
      admiralty: {
        reliability: 'E',
        credibility: 5,
        source: 'Unverified Secondary Air Defense Radar',
        ageSec: 5,
      }
    }
  ];
}

export function getInitialCommsMetrics(): CommsMetrics {
  return {
    snr: 12.5,
    packetLoss: 28,
    latencyMs: 7400,
    effectiveBandwidthKbps: 9.6,
    emconLevel: 1,
    cryptoStatus: 'LOCKED',
    activeFrequencyMHz: 148.250,
    hoppingRateHps: 0,
  };
}

export function getScriptedRadioChatter(): RadioMessage[] {
  return [
    {
      id: 'MSG-001',
      timestamp: '17:15:10',
      senderCallsign: 'CHARLIE-6',
      domain: 'LAND',
      text: 'SUNRAY, this is CHARLIE-6. Audio hash high. Intermittent visual on hostile armor in valley gorge. Can not verify company strength due to dust and smoke. Over.',
      corruptedText: 'SUNRAY, this is CH#RL!E-6. Au...io hash h#gh. Intermi...ent visual on host..e armor in valley... Over.',
      priority: 'PRIORITY',
      audioNoiseRatio: 0.35,
      admiralty: {
        reliability: 'A',
        credibility: 2,
        source: 'Direct Voice VHF (Charlie-6)',
        ageSec: 15,
      }
    },
    {
      id: 'MSG-002',
      timestamp: '17:15:28',
      senderCallsign: 'SAMYUKTA-7',
      domain: 'EW',
      text: 'ALL STATIONS: High-power barrage noise detected on VHF Channel 4 (148.250 MHz). Bearing 032 degrees azimuth. Krasukha signature verified. Switch to Frequency Hopping Plan BRAVO immediately!',
      corruptedText: 'ALL STATIONS: High-power b..rage noise on VHF... Bearing 032 deg... Switch to Freq Hopping Plan BRAVO!',
      priority: 'FLASH',
      audioNoiseRatio: 0.20,
      admiralty: {
        reliability: 'A',
        credibility: 1,
        source: 'Samyukta ESM Station',
        ageSec: 2,
      }
    },
    {
      id: 'MSG-003',
      timestamp: '17:15:52',
      senderCallsign: 'NETRA-2 (UAV)',
      domain: 'AIR',
      text: 'TACTICAL: Optical sensor anomaly. Radar reports fast-mover bearing 310 at Grid MH 7520, but EO/IR camera shows clear ridge. Suspected cyber false-track injection.',
      corruptedText: 'TACTICAL: Optical s..sor anomaly. Radar reports fast-mover b..ring 310... EO/IR camera clear. Suspect FALSE-TRACK!',
      priority: 'PRIORITY',
      isContradictory: true,
      audioNoiseRatio: 0.40,
      admiralty: {
        reliability: 'B',
        credibility: 4,
        source: 'Heron TP Optical Sensor',
        ageSec: 22,
      }
    },
    {
      id: 'MSG-004',
      timestamp: '17:16:15',
      senderCallsign: 'DHANUSH-BATTERY',
      domain: 'LAND',
      text: 'FIRE BASE BRAVO: Six 155mm howitzers laid on Target Box Alpha-4. Awaiting confirmation and positive identification before unleashing barrage. Comms delay currently 9 seconds.',
      corruptedText: 'FIRE BASE BRAVO: Six 155mm laid on T#rget Box Alpha-4. Awaiting... positive ID... Comms delay 9 sec.',
      priority: 'ROUTINE',
      audioNoiseRatio: 0.15,
      admiralty: {
        reliability: 'A',
        credibility: 1,
        source: 'Artillery Forward Command Post',
        ageSec: 10,
      }
    }
  ];
}
