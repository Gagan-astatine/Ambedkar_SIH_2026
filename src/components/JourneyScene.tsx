'use client';

import { memo, useMemo, useRef, type MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { TimelineEvent } from '../types/timeline';

export type JourneyPhase = 'travel' | 'hold';
export type JourneyStatus = 'ready' | 'running' | 'paused' | 'complete';
export interface JourneySnapshot {
  status: JourneyStatus;
  phase: JourneyPhase;
  eventIndex: number;
  progress: number;
  remainingMs: number;
}

const stationZ = (index: number) => -20 - index * 28;

function trainZ(snapshot: JourneySnapshot) {
  if (snapshot.status === 'ready' || snapshot.eventIndex < 0) return 0;
  if (snapshot.phase === 'hold' || snapshot.status === 'complete') return stationZ(snapshot.eventIndex);
  const from = snapshot.eventIndex === 0 ? 0 : stationZ(snapshot.eventIndex - 1);
  const to = stationZ(snapshot.eventIndex);
  const progress = THREE.MathUtils.clamp(snapshot.progress, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  return THREE.MathUtils.lerp(from, to, eased);
}

function Track({ snapshotRef }: { snapshotRef: MutableRefObject<JourneySnapshot> }) {
  const sleepers = useMemo(() => Array.from({ length: 54 }, (_, index) => 76 - index * 3), []);
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const z = trainZ(snapshotRef.current);
    group.current.position.z = Math.round(z / 110) * 110;
  });
  return <group ref={group}>
    <mesh position={[-0.83, 0.035, 0]}><boxGeometry args={[0.12, 0.15, 184]}/><meshStandardMaterial color="#657078" metalness={0.82} roughness={0.29}/></mesh>
    <mesh position={[0.83, 0.035, 0]}><boxGeometry args={[0.12, 0.15, 184]}/><meshStandardMaterial color="#657078" metalness={0.82} roughness={0.29}/></mesh>
    {sleepers.map((z) => <mesh key={z} position={[0, -0.07, z]}><boxGeometry args={[2.75, 0.17, 0.42]}/><meshStandardMaterial color="#302c29" roughness={0.92}/></mesh>)}
  </group>;
}

function Wheel({ x, z, angle }: { x: number; z: number; angle: number }) {
  return <mesh position={[x, -0.13, z]} rotation={[angle, 0, Math.PI / 2]}>
    <cylinderGeometry args={[0.33, 0.33, 0.17, 20]}/>
    <meshStandardMaterial color="#9b835b" metalness={0.68} roughness={0.33}/>
  </mesh>;
}

function Carriage({ z, shade, snapshotRef }: { z: number; shade: string; snapshotRef: MutableRefObject<JourneySnapshot> }) {
  const wheels = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (wheels.current && snapshotRef.current.status === 'running' && snapshotRef.current.phase === 'travel') wheels.current.rotation.x += Math.min(delta, 0.05) * 4.2;
  });
  return <group position={[0, 0, z]}>
    <mesh position={[0, 0.54, 0]}><boxGeometry args={[1.7, 0.95, 2.5]}/><meshStandardMaterial color={shade} metalness={0.48} roughness={0.47}/></mesh>
    <mesh position={[0, 1.07, 0.02]}><boxGeometry args={[1.48, 0.15, 2.25]}/><meshStandardMaterial color="#9f8357" metalness={0.65} roughness={0.34}/></mesh>
    {[-0.7, 0.7].map((x) => <mesh key={x} position={[x, 0.63, -0.03]}><boxGeometry args={[0.035, 0.42, 2.18]}/><meshStandardMaterial color="#b89e72" metalness={0.7} roughness={0.3}/></mesh>)}
    <group ref={wheels}>{[-0.72, 0.72].flatMap((x) => [-0.72, 0.72].map((wheelZ) => <Wheel key={`${x}-${wheelZ}`} x={x} z={wheelZ} angle={0}/>))}</group>
  </group>;
}

function Locomotive({ snapshotRef, reduced }: { snapshotRef: MutableRefObject<JourneySnapshot>; reduced: boolean }) {
  const train = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group>(null);
  const cameraLook = useRef(new THREE.Vector3());
  useFrame((state, delta) => {
    if (!train.current) return;
    const snapshot = snapshotRef.current;
    const targetZ = trainZ(snapshot);
    if (reduced) train.current.position.z = targetZ;
    else train.current.position.z = THREE.MathUtils.damp(train.current.position.z, targetZ, 4.8, delta);
    const moving = snapshot.status === 'running' && snapshot.phase === 'travel';
    if (wheels.current && moving && !reduced) wheels.current.rotation.x += Math.min(delta, 0.05) * 4.2;
    const camera = state.camera;
    const approach = snapshot.phase === 'hold' || snapshot.status === 'complete' ? 1 : snapshot.phase === 'travel' ? THREE.MathUtils.smoothstep(snapshot.progress, 0.52, 1) : 0;
    const desired = new THREE.Vector3(THREE.MathUtils.lerp(5.8, 4.0, approach), THREE.MathUtils.lerp(4.0, 3.35, approach), train.current.position.z + THREE.MathUtils.lerp(11.5, 7.8, approach));
    const focus = new THREE.Vector3(0, THREE.MathUtils.lerp(1.0, 1.32, approach), train.current.position.z - THREE.MathUtils.lerp(10, 4.5, approach));
    if (reduced) camera.position.copy(desired);
    else camera.position.lerp(desired, 1 - Math.exp(-delta * 2.6));
    cameraLook.current.lerp(focus, 1 - Math.exp(-delta * (reduced ? 20 : 3.2)));
    camera.lookAt(cameraLook.current);
    const event = snapshot.eventIndex;
    const yearT = Math.max(0, Math.min(1, (event / Math.max(1, 60))));
    const hue = THREE.MathUtils.lerp(0.58, 0.04, yearT) + Math.sin(yearT * Math.PI) * 0.015;
    const fog = state.scene.fog as THREE.Fog | null;
    if (fog) fog.color.setHSL(hue, 0.24, 0.075);
    if (state.scene.background instanceof THREE.Color) state.scene.background.copy(fog?.color ?? new THREE.Color('#09131d'));
  });

  return <group ref={train} position={[0, 0.48, 0]}>
      <mesh position={[0, 0.37, 0.08]}><boxGeometry args={[1.55, 0.86, 1.6]}/><meshStandardMaterial color="#24333a" metalness={0.58} roughness={0.39}/></mesh>
      <mesh position={[0, 0.69, 0.7]}><boxGeometry args={[1.28, 1.12, 0.86]}/><meshStandardMaterial color="#38464a" metalness={0.42} roughness={0.41}/></mesh>
      <mesh position={[0, 0.54, -0.72]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.39, 0.39, 1.42, 24]}/><meshStandardMaterial color="#263a40" metalness={0.62} roughness={0.32}/></mesh>
      <mesh position={[0, 0.93, -0.69]}><cylinderGeometry args={[0.15, 0.19, 0.55, 16]}/><meshStandardMaterial color="#735d40" metalness={0.58} roughness={0.32}/></mesh>
      <mesh position={[0, 0.13, -1.43]}><boxGeometry args={[1.48, 0.16, 0.42]}/><meshStandardMaterial color="#8c7048" metalness={0.66} roughness={0.32}/></mesh>
      <mesh position={[0, 0.62, -1.4]}><sphereGeometry args={[0.2, 18, 18]}/><meshBasicMaterial color="#f6c66f"/></mesh>
      <pointLight position={[0, 0.65, -2.2]} color="#ffcb73" intensity={1.7} distance={10}/>
      <group ref={wheels}>{[-0.57, 0.57].flatMap((x) => [-0.48, 0.25, 1.0].map((z) => <Wheel key={`${x}-${z}`} x={x} z={z} angle={0}/>))}</group>
      <mesh position={[0, 0.15, 1.5]}><boxGeometry args={[0.08, 0.08, 1.2]}/><meshStandardMaterial color="#b28f5d" metalness={0.76}/></mesh>
      <Carriage z={2.55} shade="#34434a" snapshotRef={snapshotRef}/>
      <mesh position={[0, 0.15, 4.0]}><boxGeometry args={[0.08, 0.08, 1.2]}/><meshStandardMaterial color="#b28f5d" metalness={0.76}/></mesh>
      <Carriage z={5.05} shade="#293940" snapshotRef={snapshotRef}/>
  </group>;
}

function Station({ event, index, snapshotRef }: { event: TimelineEvent; index: number; snapshotRef: MutableRefObject<JourneySnapshot> }) {
  const lampLeft = useRef<THREE.PointLight>(null);
  const lampRight = useRef<THREE.PointLight>(null);
  const activeGlow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const snapshot = snapshotRef.current;
    const isCurrent = snapshot.eventIndex === index;
    const atStop = isCurrent && (snapshot.phase === 'hold' || snapshot.status === 'complete');
    const approach = isCurrent && snapshot.phase === 'travel' ? THREE.MathUtils.smoothstep(snapshot.progress, 0.23, 0.92) : 0;
    const intensity = atStop ? 2.9 : isCurrent ? 0.38 + approach * 2.5 : 0.24;
    if (lampLeft.current) lampLeft.current.intensity = intensity;
    if (lampRight.current) lampRight.current.intensity = intensity;
    if (activeGlow.current) activeGlow.current.emissiveIntensity = atStop ? 2.05 : isCurrent ? 0.25 + approach * 1.8 : 0.12;
  });
  const z = stationZ(index);
  return <group position={[0, 0, z]}>
    <mesh position={[0, -0.12, 0]}><boxGeometry args={[4.2, 0.18, 5.2]}/><meshStandardMaterial color="#23323a" roughness={0.72}/></mesh>
    <mesh position={[-2.1, 0.98, 0]}><boxGeometry args={[0.11, 2.15, 0.11]}/><meshStandardMaterial color="#5e5547" metalness={0.62}/></mesh>
    <mesh position={[2.1, 0.98, 0]}><boxGeometry args={[0.11, 2.15, 0.11]}/><meshStandardMaterial color="#5e5547" metalness={0.62}/></mesh>
    <mesh position={[0, 2.05, 0]}><boxGeometry args={[4.35, 0.12, 0.12]}/><meshStandardMaterial ref={activeGlow} color="#d1b37d" emissive="#d9ae60" emissiveIntensity={0.22} metalness={0.45}/></mesh>
    <pointLight ref={lampLeft} position={[-2.08, 2.25, 0]} color="#ffca75" intensity={0.25} distance={18}/>
    <pointLight ref={lampRight} position={[2.08, 2.25, 0]} color="#ffca75" intensity={0.25} distance={18}/>
    <Html center distanceFactor={9} position={[2.85, 2.2, 0]} style={{ pointerEvents: 'none' }}>
      <div className="journey-station-sign"><strong>{event.dateLabel}</strong><span>{event.title}</span></div>
    </Html>
    <mesh position={[2.08, 1.98, 0]}><sphereGeometry args={[0.055, 12, 12]}/><meshBasicMaterial color="#ffd385"/></mesh>
  </group>;
}

function World({ events, eventIndex, snapshotRef, reduced }: { events: TimelineEvent[]; eventIndex: number; snapshotRef: MutableRefObject<JourneySnapshot>; reduced: boolean }) {
  const trackEvents = useMemo(() => events.map((event, index) => ({ event, index })).slice(Math.max(0, eventIndex - 2), Math.min(events.length, eventIndex + 5)), [events, eventIndex]);
  const ground = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ground.current) ground.current.position.z = trainZ(snapshotRef.current) - 60; });
  return <>
    <color attach="background" args={['#09131d']}/>
    <fog attach="fog" args={['#09131d', 20, 115]}/>
    <ambientLight intensity={0.64}/>
    <hemisphereLight args={['#b9d3df', '#101b20', 0.52]}/>
    <directionalLight position={[5, 12, 8]} intensity={1.1} color="#c3d4d8"/>
    <pointLight position={[-6, 3, -14]} intensity={13} color="#b98247" distance={42}/>
    <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, -60]}><planeGeometry args={[160, 240]}/><meshStandardMaterial color="#0b151b" roughness={0.97}/></mesh>
    <Track snapshotRef={snapshotRef}/>
    <Locomotive snapshotRef={snapshotRef} reduced={reduced}/>
    {trackEvents.map(({ event, index }) => <Station key={event.id} event={event} index={index} snapshotRef={snapshotRef}/>) }
  </>;
}

const JourneyCanvas = memo(function JourneyCanvas({ events, eventIndex, snapshotRef, reduced }: { events: TimelineEvent[]; eventIndex: number; snapshotRef: MutableRefObject<JourneySnapshot>; reduced: boolean }) {
  return <Canvas camera={{ position: [5.8, 4, 11.5], fov: 43, near: 0.1, far: 240 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'low-power' }} fallback={<p className="journey-scene-fallback">3D view unavailable. The station list and controls below remain available.</p>}>
    <World events={events} eventIndex={eventIndex} snapshotRef={snapshotRef} reduced={reduced}/>
  </Canvas>;
});

export default JourneyCanvas;
