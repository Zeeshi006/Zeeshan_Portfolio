"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AIState } from "./constants";

// ─────────────────────────────────────────────────────────────────────────────
// Ring Vortex Entity
//
// Each ring = circle of densely packed particles.
// Particle count is calculated so spacing ≤ size → solid glowing ring.
// Additive blending on dense rings = natural glow like reference image.
// ─────────────────────────────────────────────────────────────────────────────

const PARTICLE_SIZE = 0.072;   // base size — overlaps create glow
const MAX_PTS       = 2000;    // enough for all states

interface Ring {
  radius:  number;   // orbit radius
  tiltX:   number;   // tilt around X axis (radians)
  tiltZ:   number;   // tilt around Z axis (radians)
  speed:   number;   // rotation speed (rad/frame × 0.01)
  jitter:  number;   // radial scatter — keep near 0 for solid rings
}

interface StateConfig {
  rings:       Ring[];
  spokeCount:  number;
  globalSpeed: number;   // outer group rotation speed
}

// particles per ring = round(2π × radius / PARTICLE_SIZE) × density
function ringCount(radius: number, density = 1.0): number {
  return Math.round((2 * Math.PI * radius / PARTICLE_SIZE) * density);
}

const STATES: Record<AIState, StateConfig> = {
  dormant: {
    rings: [
      { radius: 0.6, tiltX: 0.4, tiltZ: 0.1, speed: 0.4, jitter: 0.01 },
      { radius: 1.2, tiltX: 0.2, tiltZ: 0.3, speed: 0.25, jitter: 0.02 },
    ],
    spokeCount: 0,
    globalSpeed: 0.12,
  },
  activating: {
    rings: [
      { radius: 0.4, tiltX: 0.3, tiltZ: 0.1, speed: 4.0, jitter: 0.01 },
      { radius: 0.9, tiltX: 0.6, tiltZ: 0.3, speed: 3.0, jitter: 0.01 },
      { radius: 1.4, tiltX: 0.4, tiltZ: 0.6, speed: 2.2, jitter: 0.015 },
      { radius: 2.0, tiltX: 0.2, tiltZ: 0.2, speed: 1.5, jitter: 0.02 },
      { radius: 2.6, tiltX: 0.15, tiltZ: 0.1, speed: 1.0, jitter: 0.025 },
    ],
    spokeCount: 16,
    globalSpeed: 1.8,
  },
  listening: {
    // Compressed, attentive — tighter radii, slower
    rings: [
      { radius: 0.35, tiltX: 0.1, tiltZ: 0.05, speed: 1.0, jitter: 0.005 },
      { radius: 0.70, tiltX: 0.2, tiltZ: 0.1,  speed: 0.75, jitter: 0.008 },
      { radius: 1.05, tiltX: 0.15, tiltZ: 0.15, speed: 0.55, jitter: 0.01 },
      { radius: 1.40, tiltX: 0.1, tiltZ: 0.08,  speed: 0.40, jitter: 0.012 },
    ],
    spokeCount: 8,
    globalSpeed: 0.55,
  },
  thinking: {
    // Complex — 6 rings at aggressive tilt angles, some spinning opposite
    rings: [
      { radius: 0.3, tiltX: 0.9, tiltZ: 0.2,  speed:  5.0, jitter: 0.005 },
      { radius: 0.7, tiltX: 0.3, tiltZ: 1.1,  speed: -4.0, jitter: 0.008 },
      { radius: 1.1, tiltX: 1.4, tiltZ: 0.4,  speed:  3.5, jitter: 0.01  },
      { radius: 1.6, tiltX: 0.5, tiltZ: 1.6,  speed: -2.8, jitter: 0.012 },
      { radius: 2.1, tiltX: 1.9, tiltZ: 0.6,  speed:  2.2, jitter: 0.015 },
      { radius: 2.6, tiltX: 0.7, tiltZ: 2.0,  speed: -1.6, jitter: 0.018 },
    ],
    spokeCount: 20,
    globalSpeed: 2.2,
  },
  speaking: {
    // Expanding outward — 5 rings, even spacing, energetic
    rings: [
      { radius: 0.5, tiltX: 0.1, tiltZ: 0.05, speed: 2.5, jitter: 0.008 },
      { radius: 1.0, tiltX: 0.25, tiltZ: 0.1, speed: 2.0, jitter: 0.01  },
      { radius: 1.6, tiltX: 0.2, tiltZ: 0.2,  speed: 1.5, jitter: 0.012 },
      { radius: 2.2, tiltX: 0.15, tiltZ: 0.1, speed: 1.1, jitter: 0.015 },
      { radius: 2.8, tiltX: 0.1, tiltZ: 0.05, speed: 0.8, jitter: 0.018 },
    ],
    spokeCount: 24,
    globalSpeed: 1.4,
  },
  retrieving: {
    // Inner tight core + very wide outer ring drawing in
    rings: [
      { radius: 0.3, tiltX: 0.2, tiltZ: 0.1, speed: 3.0, jitter: 0.005 },
      { radius: 0.7, tiltX: 0.5, tiltZ: 0.3, speed: 2.5, jitter: 0.008 },
      { radius: 1.3, tiltX: 0.3, tiltZ: 0.5, speed: 2.0, jitter: 0.012 },
      { radius: 2.2, tiltX: 0.2, tiltZ: 0.2, speed: 1.4, jitter: 0.02  },
      { radius: 3.2, tiltX: 0.1, tiltZ: 0.1, speed: 0.9, jitter: 0.04  },
    ],
    spokeCount: 18,
    globalSpeed: 1.6,
  },
  navigating: {
    // All rings tilted ~90° — edge-on view creates comet/ellipse shapes
    rings: [
      { radius: 0.4, tiltX: 1.45, tiltZ: 0.05, speed: 4.0, jitter: 0.008 },
      { radius: 0.9, tiltX: 1.45, tiltZ: 0.03, speed: 3.0, jitter: 0.01  },
      { radius: 1.5, tiltX: 1.45, tiltZ: 0.02, speed: 2.2, jitter: 0.015 },
      { radius: 2.2, tiltX: 1.45, tiltZ: 0.01, speed: 1.5, jitter: 0.02  },
    ],
    spokeCount: 12,
    globalSpeed: 3.0,
  },
  focused: {
    rings: [
      { radius: 0.45, tiltX: 0.3, tiltZ: 0.1,  speed: 0.9, jitter: 0.006 },
      { radius: 0.90, tiltX: 0.5, tiltZ: 0.2,  speed: 0.7, jitter: 0.008 },
      { radius: 1.40, tiltX: 0.35, tiltZ: 0.3, speed: 0.5, jitter: 0.01  },
      { radius: 1.90, tiltX: 0.2, tiltZ: 0.15, speed: 0.35, jitter: 0.012 },
    ],
    spokeCount: 14,
    globalSpeed: 0.45,
  },
};

// ── Apply tilt rotations to a point on a flat ring ────────────────────────────
function tiltPoint(x: number, y: number, z: number, tiltX: number, tiltZ: number): [number,number,number] {
  // Rotate around X
  const y1 = y * Math.cos(tiltX) - z * Math.sin(tiltX);
  const z1 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
  // Rotate around Z
  const x2 = x * Math.cos(tiltZ) - y1 * Math.sin(tiltZ);
  const y2 = x * Math.sin(tiltZ) + y1 * Math.cos(tiltZ);
  return [x2, y2, z1];
}

// ── Glow texture ──────────────────────────────────────────────────────────────
function makeGlowTex(): THREE.Texture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s/2,s/2, 0, s/2,s/2, s/2);
  g.addColorStop(0.00, "rgba(255,255,230,1.0)");    // near-white hot core
  g.addColorStop(0.18, "rgba(210,255,80,0.95)");    // bright lime
  g.addColorStop(0.45, "rgba(150,230,30,0.45)");    // mid halo
  g.addColorStop(0.75, "rgba(80,160,10,0.12)");     // outer glow
  g.addColorStop(1.00, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,s,s);
  return new THREE.CanvasTexture(c);
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { state: AIState; audioLevel: number; }

export function ParticleSystem({ state, audioLevel }: Props) {
  const groupRef  = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef  = useRef<THREE.LineSegments>(null);
  const cfg       = STATES[state] ?? STATES.focused;

  // Per-ring rotation angles (updated each frame)
  const ringAngles  = useRef(new Float32Array(8));
  // Per-ring initial phase offsets for stagger variety
  const ringPhases  = useRef((() => {
    const a = new Float32Array(8);
    for (let i=0;i<8;i++) (a as any)[i] = (Math.random()-0.5)*0.8;
    return a;
  })());
  // Spoke rotation
  const spokeAngle  = useRef(0);

  const positions = useRef(new Float32Array(MAX_PTS * 3));
  const lineVerts = useRef(new Float32Array(512 * 6));

  const geoRef = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions.current, 3).setUsage(THREE.DynamicDrawUsage));
    return g;
  }, []);

  const lineGeoRef = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(lineVerts.current, 3).setUsage(THREE.DynamicDrawUsage));
    return g;
  }, []);

  const glowTex = useMemo(() => typeof window !== "undefined" ? makeGlowTex() : null, []);

  const ptMat = useMemo(() => new THREE.PointsMaterial({
    map: glowTex ?? undefined,
    size: PARTICLE_SIZE,
    sizeAttenuation: true,
    transparent: true,
    opacity: 1.0,
    color: new THREE.Color(0xC6FF3A),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [glowTex]);

  const lnMat = useMemo(() => new THREE.LineBasicMaterial({
    color: 0xC6FF3A,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  // Reset ring angles on state change
  useEffect(() => {
    ringAngles.current.fill(0);
  }, [state]);

  useFrame((_, dt) => {
    if (!groupRef.current || !pointsRef.current) return;
    const safeDt = Math.min(dt, 0.05);

    // ── Update each ring's angle ──────────────────────────────────────────────
    let ptIdx = 0;

    cfg.rings.forEach((ring, ri) => {
      // Advance this ring's rotation
      (ringAngles.current as any)[ri] = ((ringAngles.current as any)[ri] ?? 0) + ring.speed * safeDt;
      const phase0 = (ringAngles.current as any)[ri] + ((ringPhases.current as any)[ri] ?? 0);

      // How many particles for this ring
      const count = Math.min(ringCount(ring.radius, 0.88), MAX_PTS - ptIdx - 10);
      if (count <= 0) return;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + phase0;
        const jitter = (Math.random() - 0.5) * ring.jitter;
        const r = ring.radius + jitter;

        const x0 = Math.cos(angle) * r;
        const z0 = Math.sin(angle) * r;
        const [x, y, z] = tiltPoint(x0, 0, z0, ring.tiltX, ring.tiltZ);

        const base = ptIdx * 3;
        (positions.current as any)[base]   = x;
        (positions.current as any)[base+1] = y;
        (positions.current as any)[base+2] = z;
        ptIdx++;
      }
    });

    // Zero out unused
    for (let i = ptIdx; i < MAX_PTS; i++) {
      (positions.current as any)[i*3] = 0;
      (positions.current as any)[i*3+1] = 0;
      (positions.current as any)[i*3+2] = 0;
    }

    geoRef.getAttribute("position").needsUpdate = true;
    geoRef.setDrawRange(0, ptIdx);

    // ── Spokes ────────────────────────────────────────────────────────────────
    if (linesRef.current && cfg.spokeCount > 0) {
      spokeAngle.current += cfg.globalSpeed * safeDt * 0.3;
      const outerR = (cfg.rings[cfg.rings.length-1]?.radius ?? 2.0) * 0.98;
      const innerR = 0.08;
      let li = 0;
      for (let i = 0; i < cfg.spokeCount; i++) {
        const a = (i / cfg.spokeCount) * Math.PI * 2 + spokeAngle.current;
        (lineVerts.current as any)[li++] = Math.cos(a)*innerR;
        (lineVerts.current as any)[li++] = 0;
        (lineVerts.current as any)[li++] = Math.sin(a)*innerR;
        (lineVerts.current as any)[li++] = Math.cos(a)*outerR;
        (lineVerts.current as any)[li++] = 0;
        (lineVerts.current as any)[li++] = Math.sin(a)*outerR;
      }
      lineGeoRef.getAttribute("position").needsUpdate = true;
      lineGeoRef.setDrawRange(0, cfg.spokeCount * 2);
      lnMat.opacity = 0.12 + Math.sin(Date.now()*0.002) * 0.06 + audioLevel * 0.08;
    } else if (linesRef.current) {
      lineGeoRef.setDrawRange(0, 0);
    }

    // ── Global entity rotation ────────────────────────────────────────────────
    groupRef.current.rotation.y += cfg.globalSpeed * 0.006 * safeDt * 60;
    groupRef.current.rotation.x  = Math.sin(Date.now() * 0.0003) * 0.1;

    // Audio reactive size
    ptMat.size = PARTICLE_SIZE * (1 + audioLevel * 0.25);
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={geoRef} material={ptMat} />
      <lineSegments ref={linesRef} geometry={lineGeoRef} material={lnMat} />
    </group>
  );
}
