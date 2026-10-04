import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import type { 
  ClientMessage, 
  ServerMessage, 
  RoleId, 
  RoomClient 
} from './types.ts';
import { GroundTruthEngine } from './engine/groundTruth.ts';
import { AARGenerator } from './aar/aarGenerator.ts';
import { 
  SCENARIOS, 
  getInitialUnits, 
  getInitialCommsMetrics, 
  getScriptedRadioChatter 
} from '../src/services/scenarioEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

const PORT = parseInt(process.env.PORT || '3001', 10);
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(distPath));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface ActiveRoom {
  id: string;
  engine: GroundTruthEngine;
  clients: Map<WebSocket, RoomClient>;
}

const rooms = new Map<string, ActiveRoom>();

/**
 * Retrieves or lazily creates a multiplayer simulation room.
 */
function getOrCreateRoom(roomId: string = 'ROOM_ALPHA', seed: number = 1337): ActiveRoom {
  let room = rooms.get(roomId);
  if (!room) {
    const scenario = SCENARIOS[0];
    const engine = new GroundTruthEngine(
      `SESSION-${Date.now().toString(36).toUpperCase()}`,
      scenario,
      seed,
      getInitialUnits(),
      getInitialCommsMetrics(),
      getScriptedRadioChatter()
    );

    room = {
      id: roomId,
      engine,
      clients: new Map(),
    };
    rooms.set(roomId, room);
    console.log(`[Astral-C2] New simulation room initialized: ${roomId} (Seed: ${seed})`);
  }
  return room;
}

// REST API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OPERATIONAL',
    name: 'Astral-C2 Tactical Training Server',
    version: '1.2.0-SIH',
    uptimeSec: Math.floor(process.uptime()),
    activeRooms: rooms.size,
  });
});

app.get('/api/scenarios', (_req, res) => {
  res.json(SCENARIOS);
});

app.get('/api/rooms', (_req, res) => {
  const roomList = Array.from(rooms.values()).map(r => ({
    id: r.id,
    sessionId: r.engine.sessionId,
    exerciseTimeSec: r.engine.getExerciseTime(),
    isPaused: r.engine.getIsPaused(),
    participants: Array.from(r.clients.values()),
    decisionsCount: r.engine.getDecisions().length,
    rfSignaturePct: r.engine.getEMCONState().rfSignaturePct,
  }));
  res.json(roomList);
});

app.get('/api/aar/:roomId', async (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Simulation room not found' });
  }

  const decisions = room.engine.getDecisions();
  const snapshots = room.engine.getTimelineSnapshots();
  const calibration = AARGenerator.computeCalibration(decisions, snapshots);
  const narrative = await AARGenerator.generateNarrative(
    room.engine.scenario,
    decisions,
    snapshots,
    calibration
  );

  res.json({
    sessionId: room.engine.sessionId,
    scenario: room.engine.scenario,
    exerciseTimeSec: room.engine.getExerciseTime(),
    calibration,
    decisions,
    timelineSnapshots: snapshots,
    narrative,
    auditRecord: room.engine.eventLog.exportAuditRecord(),
  });
});

app.post('/api/aar/:roomId/counterfactual', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Simulation room not found' });
  }

  const { decisionId, alternativeAction, alternativeRationale } = req.body;
  const fork = room.engine.generateCounterfactual(decisionId, alternativeAction, alternativeRationale);
  res.json(fork);
});

// SPA fallback for production deployment (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Broadcast helper for a room
function broadcastToRoom(room: ActiveRoom, msg: ServerMessage) {
  const json = JSON.stringify(msg);
  for (const [ws, _client] of room.clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  }
}

// Send role-specific state to a single client
function sendRoleState(ws: WebSocket, room: ActiveRoom, roleId: RoleId) {
  if (ws.readyState !== WebSocket.OPEN) return;

  const units = room.engine.getUnitsForRole(roleId);
  const showGroundTruth = roleId === 'INSTRUCTOR_WHITE_CELL';
  const peers = Array.from(room.clients.values()).map(c => ({
    id: c.id,
    roleId: c.roleId,
    callsign: c.callsign,
  }));

  const msg: ServerMessage = {
    type: 'INIT_STATE',
    roomId: room.id,
    roleId,
    exerciseTimeSec: room.engine.getExerciseTime(),
    isPaused: room.engine.getIsPaused(),
    scenario: room.engine.scenario,
    units,
    commsMetrics: room.engine.getCommsMetrics(),
    ewJammingIntensity: room.engine.getEWIntensity(),
    radioChatter: room.engine.getRadioChatter(),
    decisions: room.engine.getDecisions(),
    showGroundTruth,
    peers,
    emconState: room.engine.getEMCONState(),
    activeVerifications: room.engine.getActiveVerifications(),
    pendingSpoofedOrder: room.engine.getPendingSpoofedOrder(),
  };

  ws.send(JSON.stringify(msg));
}

// WebSocket Connection Management
wss.on('connection', (ws) => {
  let currentRoom: ActiveRoom | null = null;
  let currentClient: RoomClient | null = null;

  console.log('[Astral-C2] New terminal connected via WebSocket');

  ws.on('message', async (data) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());

      switch (msg.type) {
        case 'JOIN_ROOM': {
          const room = getOrCreateRoom(msg.roomId || 'ROOM_ALPHA');
          currentRoom = room;

          currentClient = {
            id: `CLIENT-${Date.now().toString(36).slice(-4)}`,
            roleId: msg.roleId,
            callsign: msg.callsign || msg.roleId,
            joinedAt: Date.now(),
          };

          room.clients.set(ws, currentClient);
          console.log(`[Astral-C2] ${currentClient.callsign} joined ${room.id} as ${currentClient.roleId}`);

          sendRoleState(ws, room, currentClient.roleId);

          const peers = Array.from(room.clients.values()).map(c => ({
            id: c.id,
            roleId: c.roleId,
            callsign: c.callsign,
          }));
          broadcastToRoom(room, { type: 'PEER_CHANGE', peers });
          break;
        }

        case 'PAUSE_SIM': {
          if (currentRoom) {
            currentRoom.engine.setPaused(true);
            broadcastToRoom(currentRoom, {
              type: 'INJECT_TRIGGERED',
              disruptionType: 'PAUSE',
              label: 'Simulation Paused by Directing Staff',
              timestamp: Date.now(),
            });
          }
          break;
        }

        case 'RESUME_SIM': {
          if (currentRoom) {
            currentRoom.engine.setPaused(false);
            broadcastToRoom(currentRoom, {
              type: 'INJECT_TRIGGERED',
              disruptionType: 'RESUME',
              label: 'Simulation Resumed',
              timestamp: Date.now(),
            });
          }
          break;
        }

        case 'RESET_SIM': {
          if (currentRoom) {
            const seed = msg.seed || Date.now();
            currentRoom.engine = new GroundTruthEngine(
              `SESSION-${Date.now().toString(36).toUpperCase()}`,
              currentRoom.engine.scenario,
              seed,
              getInitialUnits(),
              getInitialCommsMetrics(),
              getScriptedRadioChatter()
            );
            console.log(`[Astral-C2] Room ${currentRoom.id} reset with seed ${seed}`);

            for (const [clientWs, client] of currentRoom.clients.entries()) {
              sendRoleState(clientWs, currentRoom, client.roleId);
            }
          }
          break;
        }

        case 'UPDATE_EW': {
          if (currentRoom) {
            currentRoom.engine.applyEWIntensity(msg.intensityKw);
            broadcastToRoom(currentRoom, {
              type: 'INJECT_TRIGGERED',
              disruptionType: 'EW_UPDATE',
              label: `EW Jammer Power Adjusted to ${msg.intensityKw} kW`,
              timestamp: Date.now(),
            });
          }
          break;
        }

        case 'UPDATE_COMMS': {
          if (currentRoom) {
            currentRoom.engine.updateCommsMetrics(msg.metrics);
          }
          break;
        }

        case 'INJECT_DISRUPTION': {
          if (currentRoom) {
            const type = msg.disruptionType;
            if (type === 'GHOST_DRONE' || type === 'GPS_SPOOF_PRESET') {
              currentRoom.engine.injectGhostTrack();
            } else if (type === 'RADIO_DROPOUT' || type === 'VALLEY_BLACKOUT_PRESET') {
              currentRoom.engine.injectRadioBlackout('BLU-CHARLIE');
            } else if (type === 'CONTRADICTORY_FEED' || type === 'CONTRADICTORY_INTEL') {
              currentRoom.engine.injectContradictoryIntel();
            } else if (type === 'IONO_BLIZZARD' || type === 'EW_BARRAGE_PRESET') {
              currentRoom.engine.applyEWIntensity(85);
            } else if (type === 'SPOOFED_RADIO_ORDER') {
              currentRoom.engine.injectSpoofedOrder();
            }

            broadcastToRoom(currentRoom, {
              type: 'INJECT_TRIGGERED',
              disruptionType: type,
              label: `Instructor Injected: ${type.replace(/_/g, ' ')}`,
              timestamp: Date.now(),
            });
          }
          break;
        }

        case 'SEND_RADIO': {
          if (currentRoom && currentClient) {
            const domain = (msg.domain as any) || (currentClient.roleId === 'AIR_CONTROLLER' ? 'AIR' : currentClient.roleId === 'EW_CYBER_OFFICER' ? 'EW' : 'LAND');
            const message = currentRoom.engine.transmitRadioMessage({
              senderCallsign: currentClient.callsign,
              domain,
              text: msg.text,
              priority: msg.priority || 'ROUTINE',
            });
            broadcastToRoom(currentRoom, { 
              type: 'RADIO_BROADCAST', 
              message,
              rfSignaturePct: currentRoom.engine.getEMCONState().rfSignaturePct,
            });
          }
          break;
        }

        case 'SUBMIT_DECISION': {
          if (currentRoom && currentClient) {
            const { decision, snapshot } = currentRoom.engine.executeDecision(
              msg.decision,
              currentClient.roleId
            );

            broadcastToRoom(currentRoom, {
              type: 'DECISION_LOGGED',
              decision,
              snapshot,
            });
          }
          break;
        }

        case 'START_VERIFICATION': {
          if (currentRoom) {
            const verification = currentRoom.engine.startVerification(
              msg.actionType,
              msg.targetRef,
              msg.label,
              msg.durationSec
            );
            broadcastToRoom(currentRoom, {
              type: 'VERIFICATION_UPDATE',
              verification,
            });
          }
          break;
        }

        case 'RESPOND_SPOOFED_ORDER': {
          if (currentRoom) {
            const res = currentRoom.engine.respondToSpoofedOrder(msg.orderId, msg.action);
            broadcastToRoom(currentRoom, {
              type: 'INJECT_TRIGGERED',
              disruptionType: 'SPOOF_ORDER_RESOLVED',
              label: res.feedback,
              timestamp: Date.now(),
            });
          }
          break;
        }

        case 'REQUEST_COUNTERFACTUAL': {
          if (currentRoom) {
            const fork = currentRoom.engine.generateCounterfactual(
              msg.decisionId,
              msg.alternativeAction,
              msg.alternativeRationale
            );
            ws.send(JSON.stringify({ type: 'COUNTERFACTUAL_RESULT', fork }));
          }
          break;
        }

        case 'REQUEST_AAR': {
          if (currentRoom) {
            const decisions = currentRoom.engine.getDecisions();
            const snapshots = currentRoom.engine.getTimelineSnapshots();
            const calibrationScore = AARGenerator.computeCalibration(decisions, snapshots);

            const msg: ServerMessage = {
              type: 'AAR_REPORT',
              sessionId: currentRoom.engine.sessionId,
              timelineSnapshots: snapshots,
              decisions,
              calibrationScore,
            };
            ws.send(JSON.stringify(msg));
          }
          break;
        }

        case 'GENERATE_LLM_AAR': {
          if (currentRoom) {
            const decisions = currentRoom.engine.getDecisions();
            const snapshots = currentRoom.engine.getTimelineSnapshots();
            const calibrationScore = AARGenerator.computeCalibration(decisions, snapshots);
            const narrative = await AARGenerator.generateNarrative(
              currentRoom.engine.scenario,
              decisions,
              snapshots,
              calibrationScore
            );

            const msg: ServerMessage = {
              type: 'AAR_REPORT',
              sessionId: currentRoom.engine.sessionId,
              timelineSnapshots: snapshots,
              decisions,
              calibrationScore,
              llmNarrative: narrative,
            };
            ws.send(JSON.stringify(msg));
          }
          break;
        }
      }
    } catch (err) {
      console.error('[Astral-C2] Error processing client message:', err);
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Malformed message received' }));
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentClient) {
      currentRoom.clients.delete(ws);
      console.log(`[Astral-C2] ${currentClient.callsign} disconnected from ${currentRoom.id}`);

      const peers = Array.from(currentRoom.clients.values()).map(c => ({
        id: c.id,
        roleId: c.roleId,
        callsign: c.callsign,
      }));
      broadcastToRoom(currentRoom, { type: 'PEER_CHANGE', peers });
    }
  });
});

// Periodic 1-second simulation tick across all active rooms
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.engine.getIsPaused()) continue;

    const tickResult = room.engine.tick();

    if (tickResult.emconAlert) {
      broadcastToRoom(room, {
        type: 'INJECT_TRIGGERED',
        disruptionType: 'COUNTER_BATTERY_SALVO',
        label: tickResult.emconAlert,
        timestamp: Date.now(),
      });
    }

    // Stream role-specific tick updates to connected clients
    for (const [ws, client] of room.clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        const units = room.engine.getUnitsForRole(client.roleId);
        const tickMsg: ServerMessage = {
          type: 'TICK_UPDATE',
          exerciseTimeSec: room.engine.getExerciseTime(),
          units,
          commsMetrics: room.engine.getCommsMetrics(),
          activeDisruptions: room.engine.getActiveDisruptions(),
          emconState: room.engine.getEMCONState(),
          activeVerifications: room.engine.getActiveVerifications(),
          pendingSpoofedOrder: room.engine.getPendingSpoofedOrder(),
        };
        ws.send(JSON.stringify(tickMsg));
      }
    }
  }
}, 1000);

// Initialize default demonstration room
getOrCreateRoom('ROOM_ALPHA', 1337);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║                   ASTRAL-C2 TACTICAL BACKEND SERVER                   ║
║    Immersive Multi-Domain Decision Trainer for Degraded Comms Net     ║
╠════════════════════════════════════════════════════════════════════════╣
║  • HTTP REST API:       http://0.0.0.0:${PORT}                          ║
║  • WebSocket Server:    ws://0.0.0.0:${PORT}                            ║
║  • Default Room:        ROOM_ALPHA                                     ║
║  • Deterministic Seed:  1337 (Mulberry32)                              ║
║  • Deception & Spoofs:  ACTIVE (Shackle Auth Verification)             ║
║  • EMCON Signature:     ENABLED (Hostile DF Counter-Battery Physics)   ║
║  • Counterfactuals:     ENABLED (Branching AAR Decision Rewind)        ║
╚════════════════════════════════════════════════════════════════════════╝
  `);
});
