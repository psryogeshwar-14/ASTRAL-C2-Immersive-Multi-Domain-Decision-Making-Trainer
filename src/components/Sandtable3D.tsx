import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { TacticalUnit, TacticalPosition } from '../types/tactical';
import { 
  Eye, 
  Crosshair, 
  Layers, 
  Compass, 
  Radio, 
  Zap, 
  ShieldAlert
} from 'lucide-react';

interface Sandtable3DProps {
  units: TacticalUnit[];
  selectedUnitId: string | null;
  onSelectUnit: (unit: TacticalUnit) => void;
  showGroundTruth: boolean;
  ewJammingIntensity: number;
  cameraMode: 'ORBIT' | 'TOP_DOWN' | 'BUNKER' | 'FOLLOW';
  onCameraModeChange: (mode: 'ORBIT' | 'TOP_DOWN' | 'BUNKER' | 'FOLLOW') => void;
  ballisticMission: {
    active: boolean;
    startPos?: TacticalPosition;
    targetPos?: TacticalPosition;
  } | null;
}

export const Sandtable3D: React.FC<Sandtable3DProps> = ({
  units,
  selectedUnitId,
  onSelectUnit,
  showGroundTruth,
  ewJammingIntensity,
  cameraMode,
  onCameraModeChange,
  ballisticMission
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCoords, setHoveredCoords] = useState<{ x: number; y: number; z: number; elev: number } | null>(null);
  const [showRadarDomes, setShowRadarDomes] = useState<boolean>(true);
  const [showEWFields, setShowEWFields] = useState<boolean>(true);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const unitsGroupRef = useRef<THREE.Group | null>(null);
  const ewGroupRef = useRef<THREE.Group | null>(null);
  const radarGroupRef = useRef<THREE.Group | null>(null);
  const ballisticGroupRef = useRef<THREE.Group | null>(null);

  // Orbit state
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3.2, radius: 140 });

  // Procedural elevation function (Himalayan high mountain ridgeline with passes & deep gorge)
  const getElevation = (x: number, z: number): number => {
    const ridge1 = Math.sin(x * 0.045 + z * 0.03) * 12 + Math.cos(x * 0.03 - z * 0.05) * 8;
    const dPeak = Math.hypot(x - 8, z + 18);
    const peak = Math.max(0, 24 - dPeak * 0.85);
    const gorge = -Math.exp(-Math.pow(x + 5, 2) / 80) * 10;
    const plateau = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 4;
    return Math.max(0, (ridge1 + peak + gorge + plateau + 12) * 0.65);
  };

  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = cameraAngleRef.current;

    if (cameraMode === 'TOP_DOWN') {
      cameraRef.current.position.set(0, 160, 0.001);
      cameraRef.current.lookAt(0, 0, 0);
    } else if (cameraMode === 'BUNKER') {
      cameraRef.current.position.set(-65, 30, 65);
      cameraRef.current.lookAt(0, 10, 0);
    } else {
      const x = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.position.set(x, Math.max(12, y), z);
      cameraRef.current.lookAt(0, 10, 0);
    }
  }, [cameraMode]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // SCENE SETUP
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x040810);
    scene.fog = new THREE.FogExp2(0x040810, 0.0035);

    // CAMERA SETUP
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    cameraRef.current = camera;
    updateCameraPosition();

    // RENDERER SETUP
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(0x1a2638, 1.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0x7ed0ff, 2.0);
    sunLight.position.set(60, 100, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const cyanPoint = new THREE.PointLight(0x00e5ff, 3, 160);
    cyanPoint.position.set(-20, 35, 10);
    scene.add(cyanPoint);

    // 3D PROCEDURAL TERRAIN MESH
    const terrainSize = 180;
    const segments = 100;
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position;
    const colors: number[] = [];
    const colorTop = new THREE.Color(0x103248);
    const colorMid = new THREE.Color(0x0a1c2a);
    const colorLow = new THREE.Color(0x040c14);
    const colorSnow = new THREE.Color(0x386b8c);

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const y = getElevation(x, z);
      posAttr.setY(i, y);

      if (y > 18) {
        colors.push(colorSnow.r, colorSnow.g, colorSnow.b);
      } else if (y > 10) {
        colors.push(colorTop.r, colorTop.g, colorTop.b);
      } else if (y > 4) {
        colors.push(colorMid.r, colorMid.g, colorMid.b);
      } else {
        colors.push(colorLow.r, colorLow.g, colorLow.b);
      }
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.15,
      flatShading: false,
    });
    const terrainMesh = new THREE.Mesh(geometry, terrainMaterial);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // HOLOGRAPHIC CONTOUR WIREFRAME
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);
    wireframeMesh.position.y += 0.05;
    scene.add(wireframeMesh);

    // TACTICAL MILITARY COORDINATE GRID
    const gridHelper = new THREE.GridHelper(terrainSize, 36, 0x00ff88, 0x073b30);
    gridHelper.position.y = 0.2;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.35;
    scene.add(gridHelper);

    // BOUNDARY SCANNER CORNER POSTS
    const corners = [
      [-terrainSize / 2, -terrainSize / 2],
      [terrainSize / 2, -terrainSize / 2],
      [terrainSize / 2, terrainSize / 2],
      [-terrainSize / 2, terrainSize / 2],
    ];
    corners.forEach(([cx, cz]) => {
      const pylonGeom = new THREE.CylinderGeometry(0.4, 0.4, 30, 8);
      const pylonMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.4 });
      const pylon = new THREE.Mesh(pylonGeom, pylonMat);
      pylon.position.set(cx, 15, cz);
      scene.add(pylon);
    });

    // GROUPS FOR DYNAMIC ASSETS
    const unitsGroup = new THREE.Group();
    unitsGroupRef.current = unitsGroup;
    scene.add(unitsGroup);

    const radarGroup = new THREE.Group();
    radarGroupRef.current = radarGroup;
    scene.add(radarGroup);

    const ewGroup = new THREE.Group();
    ewGroupRef.current = ewGroup;
    scene.add(ewGroup);

    const ballisticGroup = new THREE.Group();
    ballisticGroupRef.current = ballisticGroup;
    scene.add(ballisticGroup);

    // MOUSE DRAG / ORBIT HANDLERS
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDraggingRef.current = true;
        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const deltaX = e.clientX - previousMousePositionRef.current.x;
        const deltaY = e.clientY - previousMousePositionRef.current.y;

        cameraAngleRef.current.theta -= deltaX * 0.007;
        cameraAngleRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2.05, cameraAngleRef.current.phi + deltaY * 0.007));
        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
        updateCameraPosition();
      }

      if (rendererRef.current && cameraRef.current) {
        const rect = rendererRef.current.domElement.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
        const intersects = raycaster.intersectObject(terrainMesh);
        if (intersects.length > 0) {
          const pt = intersects[0].point;
          setHoveredCoords({
            x: Math.round(pt.x * 10) / 10,
            y: Math.round(pt.y * 10) / 10,
            z: Math.round(pt.z * 10) / 10,
            elev: Math.round(3800 + pt.y * 85),
          });
        }
      }
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraAngleRef.current.radius = Math.max(30, Math.min(260, cameraAngleRef.current.radius + e.deltaY * 0.08));
      updateCameraPosition();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // RESIZE LISTENER & RESIZE OBSERVER (Screen-Friendly dynamic resizing)
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w > 0 && h > 0) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // ANIMATION LOOP
    let animationFrameId: number;
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = (performance.now() - startTime) * 0.001;

      if (radarGroupRef.current) {
        radarGroupRef.current.children.forEach((child) => {
          if (child.name === 'radarSweep') {
            child.rotation.y = elapsedTime * 1.5;
          }
        });
      }

      if (ewGroupRef.current) {
        ewGroupRef.current.children.forEach((child) => {
          if (child.name === 'ewSphere') {
            const scale = 1 + Math.sin(elapsedTime * 3) * 0.06;
            child.scale.set(scale, scale, scale);
            const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
            if (mat) {
              mat.opacity = 0.22 + Math.sin(elapsedTime * 4) * 0.08;
            }
          }
        });
      }

      if (unitsGroupRef.current) {
        unitsGroupRef.current.children.forEach((unitObj) => {
          const uncertaintyMesh = unitObj.getObjectByName('uncertaintyRing');
          if (uncertaintyMesh) {
            const pulse = 1 + Math.sin(elapsedTime * 2.5) * 0.08;
            uncertaintyMesh.scale.set(pulse, 1, pulse);
          }
          const beacon = unitObj.getObjectByName('beacon');
          if (beacon) {
            beacon.rotation.y = elapsedTime * 2;
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      renderer.dispose();
      geometry.dispose();
      terrainMaterial.dispose();
    };
  }, [updateCameraPosition]);

  useEffect(() => {
    updateCameraPosition();
  }, [updateCameraPosition]);

  // RENDER / UPDATE TACTICAL UNITS IN 3D
  useEffect(() => {
    if (!unitsGroupRef.current || !sceneRef.current) return;
    const group = unitsGroupRef.current;

    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
    }

    units.forEach((unit) => {
      const unitContainer = new THREE.Group();
      unitContainer.name = `unit_${unit.id}`;

      const targetPos = showGroundTruth ? unit.groundTruthPos : unit.perceivedPos;
      
      if (unit.isGhostContact && showGroundTruth) {
        return;
      }

      const x = targetPos.x;
      const z = targetPos.z;
      const groundY = getElevation(x, z);
      const y = unit.domain === 'AIR' ? groundY + 16 : groundY + 0.8;

      unitContainer.position.set(x, y, z);

      let colorHex = 0x00e5ff;
      if (unit.affiliation === 'OPFOR') colorHex = 0xff1744;
      if (unit.isGhostContact) colorHex = 0xee00ff;
      if (unit.isContradictory) colorHex = 0xffaa00;

      const isSelected = unit.id === selectedUnitId;

      let geom: THREE.BufferGeometry;
      if (unit.domain === 'AIR') {
        geom = new THREE.ConeGeometry(1.6, 3.2, 3);
        geom.rotateX(Math.PI / 2);
      } else if (unit.domain === 'EW') {
        geom = new THREE.OctahedronGeometry(1.8);
      } else {
        geom = new THREE.CylinderGeometry(1.4, 1.8, 2.2, 6);
      }

      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: isSelected ? 1.0 : 0.45,
        roughness: 0.2,
        metalness: 0.8,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = 'beacon';
      mesh.castShadow = true;
      unitContainer.add(mesh);

      if (isSelected) {
        const ringGeom = new THREE.RingGeometry(2.5, 3.0, 32);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.y = 0.5;
        unitContainer.add(ring);
      }

      if (unit.domain === 'AIR') {
        const stalkGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, -(y - groundY), 0),
        ]);
        const stalkMat = new THREE.LineDashedMaterial({
          color: colorHex,
          dashSize: 1,
          gapSize: 0.8,
          transparent: true,
          opacity: 0.6,
        });
        const stalk = new THREE.Line(stalkGeom, stalkMat);
        stalk.computeLineDistances();
        unitContainer.add(stalk);
      }

      const radiusScaled = Math.max(2.5, (unit.uncertaintyRadius || 100) / 140);
      const uncRingGeom = new THREE.RingGeometry(radiusScaled - 0.3, radiusScaled + 0.3, 32);
      uncRingGeom.rotateX(-Math.PI / 2);
      const uncRingMat = new THREE.MeshBasicMaterial({
        color: unit.isGhostContact ? 0xee00ff : 0xff9900,
        transparent: true,
        opacity: Math.min(0.7, 0.2 + (unit.uncertaintyRadius / 1500)),
        side: THREE.DoubleSide,
      });
      const uncRing = new THREE.Mesh(uncRingGeom, uncRingMat);
      uncRing.name = 'uncertaintyRing';
      uncRing.position.y = -(y - groundY) + 0.2;
      unitContainer.add(uncRing);

      group.add(unitContainer);
    });
  }, [units, selectedUnitId, showGroundTruth]);

  // RENDER RADAR COVERAGE & EW JAMMING FIELDS
  useEffect(() => {
    if (!ewGroupRef.current || !radarGroupRef.current) return;

    const ewGroup = ewGroupRef.current;
    while (ewGroup.children.length > 0) {
      ewGroup.remove(ewGroup.children[0]);
    }

    if (showEWFields && ewJammingIntensity > 0) {
      const jammerX = 50;
      const jammerZ = -35;
      const jammerY = getElevation(jammerX, jammerZ);

      const fieldRadius = 25 + (ewJammingIntensity / 100) * 55;
      const ewGeom = new THREE.SphereGeometry(fieldRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const ewMat = new THREE.MeshBasicMaterial({
        color: 0xff0055,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      });
      const ewSphere = new THREE.Mesh(ewGeom, ewMat);
      ewSphere.name = 'ewSphere';
      ewSphere.position.set(jammerX, jammerY, jammerZ);
      ewGroup.add(ewSphere);

      const coneGeom = new THREE.ConeGeometry(fieldRadius * 0.8, fieldRadius * 1.4, 16, 1, true);
      coneGeom.rotateX(-Math.PI / 2);
      coneGeom.rotateY(-Math.PI / 4);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xff3300,
        wireframe: true,
        transparent: true,
        opacity: 0.18,
      });
      const cone = new THREE.Mesh(coneGeom, coneMat);
      cone.position.set(jammerX, jammerY, jammerZ);
      ewGroup.add(cone);
    }

    const radarGroup = radarGroupRef.current;
    while (radarGroup.children.length > 0) {
      radarGroup.remove(radarGroup.children[0]);
    }

    if (showRadarDomes) {
      const radX = -40;
      const radZ = 0;
      const radY = getElevation(radX, radZ);
      const radarRadius = 45;

      const domeGeom = new THREE.SphereGeometry(radarRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
      const domeMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        wireframe: true,
        transparent: true,
        opacity: 0.12,
      });
      const dome = new THREE.Mesh(domeGeom, domeMat);
      dome.position.set(radX, radY, radZ);
      radarGroup.add(dome);

      const sweepGeom = new THREE.PlaneGeometry(radarRadius, 0.4);
      const sweepMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide });
      const sweep = new THREE.Mesh(sweepGeom, sweepMat);
      sweep.name = 'radarSweep';
      sweep.position.set(radX, radY + 2, radZ);
      sweep.rotation.x = -Math.PI / 2;
      radarGroup.add(sweep);
    }
  }, [ewJammingIntensity, showEWFields, showRadarDomes]);

  // BALLISTIC ARCS FOR ARTILLERY / MISSILES
  useEffect(() => {
    if (!ballisticGroupRef.current || !ballisticMission || !ballisticMission.active) return;
    const group = ballisticGroupRef.current;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const start = ballisticMission.startPos || { x: -60, y: 8.5, z: 45 };
    const target = ballisticMission.targetPos || { x: 22, y: 11.0, z: -10 };

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(start.x, start.y, start.z),
      new THREE.Vector3((start.x + target.x) / 2, Math.max(start.y, target.y) + 38, (start.z + target.z) / 2),
      new THREE.Vector3(target.x, target.y, target.z)
    );

    const points = curve.getPoints(50);
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 2 });
    const line = new THREE.Line(geom, mat);
    group.add(line);

    const impactGeom = new THREE.RingGeometry(0.5, 4.5, 24);
    impactGeom.rotateX(-Math.PI / 2);
    const impactMat = new THREE.MeshBasicMaterial({ color: 0xff4400, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const impact = new THREE.Mesh(impactGeom, impactMat);
    impact.position.set(target.x, target.y + 0.5, target.z);
    group.add(impact);
  }, [ballisticMission]);

  return (
    <div className="sandtable-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

      {/* TOP HUD BAR */}
      <div className="tactical-hud-top" style={{
        position: 'absolute',
        top: '14px',
        left: '16px',
        right: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          background: 'rgba(5, 15, 25, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: '6px',
          padding: '8px 16px',
          display: 'flex',
          gap: '18px',
          alignItems: 'center',
          pointerEvents: 'auto',
          boxShadow: '0 4px 20px rgba(0, 229, 255, 0.15)',
        }}>
          <div>
            <div style={{ fontSize: '10px', color: '#00e5ff', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700 }}>
              Holographic Sandtable 3D
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e0f7fa', fontFamily: 'Rajdhani, sans-serif' }}>
              GALWAN - TRISHUL RIDGELINE SECTOR [GRID 43X]
            </div>
          </div>

          <div style={{ height: '24px', width: '1px', background: 'rgba(0, 229, 255, 0.2)' }} />

          <div>
            <div style={{ fontSize: '9px', color: '#80deea' }}>TERRAIN ELEVATION</div>
            <div style={{ fontSize: '13px', color: '#76ff03', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
              {hoveredCoords ? `${hoveredCoords.elev} m AMSL` : '4,850 m (AVG)'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '9px', color: '#80deea' }}>MGRS CURSOR</div>
            <div style={{ fontSize: '13px', color: '#00e5ff', fontFamily: 'JetBrains Mono, monospace' }}>
              {hoveredCoords ? `MH ${Math.abs(Math.round(hoveredCoords.x * 100))} ${Math.abs(Math.round(hoveredCoords.z * 100))}` : 'MH 7412 8821'}
            </div>
          </div>
        </div>

        {/* Camera Perspective Mode Selectors */}
        <div style={{
          background: 'rgba(5, 15, 25, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: '6px',
          padding: '6px',
          display: 'flex',
          gap: '6px',
          pointerEvents: 'auto',
        }}>
          <button
            onClick={() => onCameraModeChange('ORBIT')}
            className={`hud-btn ${cameraMode === 'ORBIT' ? 'active' : ''}`}
            title="3D Holographic Orbit Sandtable"
            style={{
              background: cameraMode === 'ORBIT' ? 'rgba(0, 229, 255, 0.25)' : 'transparent',
              border: cameraMode === 'ORBIT' ? '1px solid #00e5ff' : '1px solid transparent',
              color: cameraMode === 'ORBIT' ? '#00e5ff' : '#90a4ae',
              borderRadius: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <Compass size={14} /> 3D ORBIT
          </button>

          <button
            onClick={() => onCameraModeChange('TOP_DOWN')}
            className={`hud-btn ${cameraMode === 'TOP_DOWN' ? 'active' : ''}`}
            title="Overhead 2D/3D Tactical COP Map"
            style={{
              background: cameraMode === 'TOP_DOWN' ? 'rgba(0, 229, 255, 0.25)' : 'transparent',
              border: cameraMode === 'TOP_DOWN' ? '1px solid #00e5ff' : '1px solid transparent',
              color: cameraMode === 'TOP_DOWN' ? '#00e5ff' : '#90a4ae',
              borderRadius: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <Crosshair size={14} /> TOP-DOWN COP
          </button>

          <button
            onClick={() => onCameraModeChange('BUNKER')}
            className={`hud-btn ${cameraMode === 'BUNKER' ? 'active' : ''}`}
            title="TOC Underground Command Bunker View"
            style={{
              background: cameraMode === 'BUNKER' ? 'rgba(0, 229, 255, 0.25)' : 'transparent',
              border: cameraMode === 'BUNKER' ? '1px solid #00e5ff' : '1px solid transparent',
              color: cameraMode === 'BUNKER' ? '#00e5ff' : '#90a4ae',
              borderRadius: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <Eye size={14} /> BUNKER TOC
          </button>
        </div>
      </div>

      {/* LAYER TOGGLES */}
      <div style={{
        position: 'absolute',
        bottom: '18px',
        left: '16px',
        display: 'flex',
        gap: '8px',
        pointerEvents: 'auto',
      }}>
        <button
          onClick={() => setShowRadarDomes(!showRadarDomes)}
          style={{
            background: showRadarDomes ? 'rgba(0, 255, 136, 0.2)' : 'rgba(5, 15, 25, 0.8)',
            border: `1px solid ${showRadarDomes ? '#00ff88' : 'rgba(255, 255, 255, 0.2)'}`,
            color: showRadarDomes ? '#00ff88' : '#78909c',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
        >
          <Radio size={13} /> RADAR DOMES {showRadarDomes ? 'ON' : 'OFF'}
        </button>

        <button
          onClick={() => setShowEWFields(!showEWFields)}
          style={{
            background: showEWFields ? 'rgba(255, 23, 68, 0.2)' : 'rgba(5, 15, 25, 0.8)',
            border: `1px solid ${showEWFields ? '#ff1744' : 'rgba(255, 255, 255, 0.2)'}`,
            color: showEWFields ? '#ff1744' : '#78909c',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
        >
          <Zap size={13} /> EW JAMMING FIELDS {showEWFields ? 'ON' : 'OFF'}
        </button>

        {showGroundTruth ? (
          <div style={{
            background: 'rgba(255, 23, 68, 0.25)',
            border: '1px solid #ff1744',
            color: '#ff8a80',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <ShieldAlert size={14} /> WHITE CELL GROUND TRUTH ACTIVE
          </div>
        ) : (
          <div style={{
            background: 'rgba(0, 229, 255, 0.15)',
            border: '1px solid rgba(0, 229, 255, 0.4)',
            color: '#80deea',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <Layers size={14} /> TRAINEE DEGRADED OPERATING PICTURE
          </div>
        )}
      </div>

      {/* QUICK UNIT SELECTION STRIP */}
      <div style={{
        position: 'absolute',
        bottom: '18px',
        right: '16px',
        display: 'flex',
        gap: '6px',
        background: 'rgba(5, 15, 25, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(0, 229, 255, 0.3)',
        borderRadius: '6px',
        padding: '6px 8px',
        pointerEvents: 'auto',
      }}>
        <div style={{ fontSize: '10px', color: '#80deea', display: 'flex', alignItems: 'center', padding: '0 6px', fontWeight: 700 }}>
          ASSETS:
        </div>
        {units.slice(0, 5).map((u) => {
          const isSel = u.id === selectedUnitId;
          const isBlu = u.affiliation === 'BLUFOR';
          return (
            <button
              key={u.id}
              onClick={() => onSelectUnit(u)}
              style={{
                background: isSel ? (isBlu ? 'rgba(0, 229, 255, 0.3)' : 'rgba(255, 23, 68, 0.3)') : 'rgba(10, 25, 40, 0.6)',
                border: `1px solid ${isSel ? (isBlu ? '#00e5ff' : '#ff1744') : 'rgba(255, 255, 255, 0.15)'}`,
                color: isBlu ? '#80deea' : '#ff8a80',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '10px',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {u.callsign.split(' ')[0]}
            </button>
          );
        })}
      </div>
    </div>
  );
};
