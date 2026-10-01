'use client';

import { memo, useMemo, useRef, type MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  RING_RADIUS, NODE_SPACING, connectorPose, nodeCenter, orbitDirection, orbitPose, snapshotPose,
  type MotionSnapshot,
} from '../knowledge/timeline-motion';

const metal = '#87939b';
const teal = '#489b9b';
const gold = '#bd9660';

function TimelineRail({ index }: { index: number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(
    Array.from({ length: 26 }, (_, step) => {
      const pose = connectorPose(index, step / 25);
      return new THREE.Vector3(pose.x, pose.y, 0.13);
    }), false, 'centripetal', 0.5,
  ), [index]);
  return <group>
    <mesh position={[0, 0, -0.06]}><tubeGeometry args={[curve, 50, 0.125, 8, false]}/><meshStandardMaterial color="#e4e2d9" metalness={0.18} roughness={0.56}/></mesh>
    <mesh><tubeGeometry args={[curve, 60, 0.032, 8, false]}/><meshStandardMaterial color={metal} metalness={0.82} roughness={0.25}/></mesh>
  </group>;
}

function OrbitalTrack({ index, active }: { index: number; active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const highlight = useRef<THREE.MeshStandardMaterial>(null);
  const center = nodeCenter(index);
  const color = index % 3 === 1 ? teal : index % 3 === 2 ? '#849bb3' : gold;
  const arc = useMemo(() => new THREE.CatmullRomCurve3(
    Array.from({ length: 43 }, (_, step) => {
      const direction = orbitDirection(index);
      const angle = Math.PI + direction * Math.PI * (step / 42);
      const point = orbitPose(index, angle);
      return new THREE.Vector3(point.x - center.x, point.y - center.y, 0.16);
    }), false, 'centripetal', 0.5,
  ), [index, center.x, center.y]);
  useFrame((_, delta) => {
    if (group.current) group.current.position.z = THREE.MathUtils.damp(group.current.position.z, active ? 0.13 : 0, 7, delta);
    if (highlight.current) highlight.current.emissiveIntensity = THREE.MathUtils.damp(highlight.current.emissiveIntensity, active ? 0.24 : 0.015, 6, delta);
  });
  return <group position={[center.x, center.y, 0]} ref={group}>
    <mesh position={[0.06, -0.09, -0.16]}><torusGeometry args={[RING_RADIUS, 0.13, 8, 72]}/><meshBasicMaterial color="#b9b8aa" transparent opacity={0.14} depthWrite={false}/></mesh>
    <mesh position={[0, 0, 0.035]}><torusGeometry args={[RING_RADIUS, 0.11, 10, 84]}/><meshStandardMaterial color={active ? '#b7c9c9' : '#dddcd2'} metalness={0.48} roughness={0.48}/></mesh>
    <mesh position={[0, 0, 0.12]}><torusGeometry args={[RING_RADIUS, 0.034, 10, 96]}/><meshStandardMaterial color={active ? '#728990' : '#b8bfbd'} metalness={0.88} roughness={0.22}/></mesh>
    <mesh><tubeGeometry args={[arc, 64, active ? 0.047 : 0.032, 8, false]}/><meshStandardMaterial ref={highlight} color={color} emissive={color} emissiveIntensity={0.02} metalness={0.68} roughness={0.32}/></mesh>
    {active && <mesh position={[0, 0, -0.11]}><circleGeometry args={[RING_RADIUS - 0.11, 48]}/><meshBasicMaterial color="#fffdf6" transparent opacity={0.2} depthWrite={false}/></mesh>}
  </group>;
}

function TimelineNode({ index, active }: { index: number; active: boolean }) {
  return <OrbitalTrack index={index} active={active}/>;
}

function TrainWheel({ x, y, snapshotRef }: { x: number; y: number; snapshotRef: MutableRefObject<MotionSnapshot> }) {
  const wheel = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (wheel.current && snapshotRef.current.status === 'running' && snapshotRef.current.phase !== 'hold') wheel.current.rotation.z -= Math.min(delta, 0.04) * 8;
  });
  return <group position={[x, y, 0.05]} ref={wheel}>
    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.085, 0.085, 0.07, 16]}/>
      <meshStandardMaterial color="#34444b" metalness={0.54} roughness={0.38}/>
    </mesh>
    <mesh position={[0.034, 0, 0.043]}><boxGeometry args={[0.055, 0.013, 0.008]}/><meshStandardMaterial color={gold} metalness={0.7} roughness={0.3}/></mesh>
  </group>;
}

function TimelineTrain({ snapshotRef, count, reduced }: { snapshotRef: MutableRefObject<MotionSnapshot>; count: number; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef(0);
  useFrame((_, delta) => {
    if (!group.current || !count) return;
    const snapshot = snapshotRef.current;
    const pose = snapshotPose(snapshot, count);
    const moving = snapshot.status === 'running' && snapshot.phase !== 'hold';
    motion.current += moving ? Math.min(delta, 0.04) * 11 : 0;
    group.current.position.set(pose.x, pose.y, pose.z + (moving && !reduced ? Math.sin(motion.current * 1.8) * 0.012 : 0));
    group.current.rotation.z = pose.heading;
  });
  return <group ref={group}>
    <mesh position={[0.04, -0.02, -0.17]}><circleGeometry args={[0.59, 24]}/><meshBasicMaterial color="#59646a" transparent opacity={0.15} depthWrite={false}/></mesh>
    <mesh position={[0.03, 0, 0.03]} castShadow><boxGeometry args={[0.83, 0.3, 0.3]}/><meshStandardMaterial color="#33434b" metalness={0.76} roughness={0.28}/></mesh>
    <mesh position={[0.03, 0.06, 0.23]} castShadow><boxGeometry args={[0.72, 0.21, 0.12]}/><meshStandardMaterial color="#778991" metalness={0.84} roughness={0.22}/></mesh>
    <mesh position={[0.12, 0.08, 0.3]}><boxGeometry args={[0.4, 0.1, 0.02]}/><meshStandardMaterial color="#93bec1" metalness={0.45} roughness={0.13} emissive="#287b82" emissiveIntensity={0.18}/></mesh>
    <mesh position={[0.44, 0.005, 0.04]} castShadow><coneGeometry args={[0.18, 0.27, 6]}/><meshStandardMaterial color="#52626b" metalness={0.78} roughness={0.27}/></mesh>
    <mesh position={[0.52, 0.01, 0.09]}><sphereGeometry args={[0.05, 10, 10]}/><meshBasicMaterial color="#d1b37e"/></mesh>
    <mesh position={[-0.36, 0.17, 0.07]}><boxGeometry args={[0.05, 0.025, 0.24]}/><meshStandardMaterial color={gold} metalness={0.84} roughness={0.27}/></mesh>
    <mesh position={[-0.55, 0, 0.02]} castShadow><boxGeometry args={[0.28, 0.25, 0.27]}/><meshStandardMaterial color="#34434a" metalness={0.67} roughness={0.32}/></mesh>
    <mesh position={[-0.55, 0.01, 0.18]}><boxGeometry args={[0.21, 0.085, 0.018]}/><meshStandardMaterial color="#759da2" metalness={0.51} roughness={0.2}/></mesh>
    {[-0.38, -0.03, 0.3].map((x) => <TrainWheel key={x} x={x} y={-0.18} snapshotRef={snapshotRef}/>)}
  </group>;
}

function CameraRig({ viewXRef, snapshotRef, stageHeight }: { viewXRef: MutableRefObject<number>; snapshotRef: MutableRefObject<MotionSnapshot>; stageHeight: number }) {
  useFrame((state, delta) => {
    const camera = state.camera;
    const viewX = viewXRef.current;
    const emphasis = snapshotRef.current.phase === 'orbit' || snapshotRef.current.phase === 'hold' ? 0.16 : 0;
    const factor = snapshotRef.current.status === 'running' ? 1 - Math.exp(-delta * 10) : 1;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, viewX, factor);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.55 - emphasis, factor);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 12.5 - emphasis, factor);
    camera.lookAt(camera.position.x, 0, 0);
    const orthographic = camera as THREE.OrthographicCamera;
    const zoom = stageHeight / 8;
    if (orthographic.zoom !== zoom) { orthographic.zoom = zoom; orthographic.updateProjectionMatrix(); }
  });
  return null;
}

function TimelineWorld({ count, activeIndex, viewX, viewXRef, snapshotRef, reduced, stageHeight }: {
  count: number; activeIndex: number; viewX: number; viewXRef: MutableRefObject<number>;
  snapshotRef: MutableRefObject<MotionSnapshot>; reduced: boolean; stageHeight: number;
}) {
  const central = Math.max(0, Math.round(viewX / NODE_SPACING));
  const first = Math.max(0, central - 4);
  const last = Math.min(count - 1, central + 4);
  const visibleNodes = Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i);
  return <>
    <ambientLight intensity={1.18}/>
    <hemisphereLight args={['#ffffff', '#d6e4e5', 0.9]}/>
    <directionalLight position={[-2, 5, 8]} intensity={1.7} color="#fffaf0" castShadow shadow-mapSize={[512, 512]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={7} shadow-camera-bottom={-7}/>
    {visibleNodes.slice(0, -1).map((index) => <TimelineRail key={`connector-${index}`} index={index}/>)}
    {visibleNodes.map((index) => <TimelineNode key={`orbit-${index}`} index={index} active={index === activeIndex}/>)}
    <TimelineTrain snapshotRef={snapshotRef} count={count} reduced={reduced}/>
    <CameraRig viewXRef={viewXRef} snapshotRef={snapshotRef} stageHeight={stageHeight}/>
  </>;
}

const TimelineScene = memo(function TimelineScene({ count, activeIndex, viewX, viewXRef, snapshotRef, stageHeight, visible, moving, reduced }: {
  count: number; activeIndex: number; viewX: number; viewXRef: MutableRefObject<number>;
  snapshotRef: MutableRefObject<MotionSnapshot>; stageHeight: number; visible: boolean; moving: boolean; reduced: boolean;
}) {
  return <Canvas orthographic shadows camera={{ position: [viewX, 1.55, 12.5], zoom: stageHeight / 8, near: 0.1, far: 50 }} dpr={[1, 1.5]}
    gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} frameloop={visible && moving ? 'always' : 'demand'}
    fallback={<p className="orbit-scene-fallback">3D view unavailable. Use the event nodes and source controls.</p>}>
    <TimelineWorld count={count} activeIndex={activeIndex} viewX={viewX} viewXRef={viewXRef} snapshotRef={snapshotRef} reduced={reduced} stageHeight={stageHeight}/>
  </Canvas>;
});

export default TimelineScene;
