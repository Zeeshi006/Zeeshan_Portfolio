"use client";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AIState } from "../store/aiStore";

// ─────────────────────────────────────────────────────────────────────────────
// ParticleField — GPU particle system (custom vertex + fragment shaders)
//
// 2000 particles in orbital motion around the singularity.
// Vertex shader computes position each frame: angular orbit + vertical oscillation
// + gravity pull toward center scaled by uEnergy.
// Fragment shader renders soft circular glow particles with additive blending.
//
// Draw range varies by AI state:
//   dormant=80, activating=1800, thinking=1600, speaking=1200, etc.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PARTICLES = 2000;

// Draw range per state (how many particles are "active")
const STATE_DRAW_RANGE: Record<AIState, number> = {
  dormant:    80,
  activating: 1800,
  listening:  900,
  thinking:   1600,
  speaking:   1200,
  retrieving: 1100,
  navigating: 800,
  focused:    700,
};

// ── Vertex Shader ─────────────────────────────────────────────────────────────
// Custom attributes: aSize, aOpacity, aSpeed, aPhase, aRadius, aAngle
// Each frame:
//   angle += time * aSpeed  → orbital motion
//   y oscillation via sin(time * 0.8 + aPhase)
//   gravity pull toward center scaled by uEnergy
//   gl_PointSize = aSize * (280.0 / -mvPosition.z)
const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  attribute float aSpeed;
  attribute float aPhase;
  attribute float aRadius;
  attribute float aAngle;

  uniform float uTime;
  uniform float uEnergy;
  uniform float uAudio;

  varying float vOpacity;
  varying float vDist;

  void main() {
    // Accumulate angle over time using per-particle speed
    float angle = aAngle + uTime * aSpeed;

    // Gravity: pull particles inward proportional to energy
    // More energy → tighter orbit radius (accretion effect)
    float gravityFactor = 1.0 - uEnergy * 0.18;
    float r = aRadius * gravityFactor;

    // Orbital position in XZ plane
    float px = cos(angle) * r;
    float pz = sin(angle) * r;

    // Vertical oscillation — gives 3D depth to the field
    float py = sin(uTime * 0.8 + aPhase) * 0.25 * (1.0 - uEnergy * 0.4);

    // Audio reactivity: extra vertical kick on beat
    py += sin(uTime * 4.0 + aPhase * 2.0) * uAudio * 0.15;

    vec3 pos = vec3(px, py, pz);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // PointSize: perspective-correct, boosted by energy + audio
    float energyBoost = 1.0 + uEnergy * 0.5 + uAudio * 0.35;
    gl_PointSize = aSize * energyBoost * (280.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 28.0);

    gl_Position = projectionMatrix * mvPosition;

    vOpacity = aOpacity;
    // Normalized distance from center (0 = center, 1 = max radius)
    vDist = r / 4.0;
  }
`;

// ── Fragment Shader ───────────────────────────────────────────────────────────
// Soft circular glow — discard outside radius 0.5
// Color mixes between dim lime (far from center) and bright white-lime (near center)
// Additive blending is set on the material; alpha controls contribution
const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  varying float vOpacity;
  varying float vDist;

  // Signal-lime palette
  // --signal:     #C6FF3A = vec3(0.776, 1.0, 0.227)
  // --signal-dim: #8FB82A = vec3(0.561, 0.722, 0.165)
  const vec3 SIGNAL_BRIGHT = vec3(0.95,  1.0,  0.75);   // near-white-lime core
  const vec3 SIGNAL        = vec3(0.776, 1.0,  0.227);
  const vec3 SIGNAL_DIM    = vec3(0.35,  0.52, 0.09);   // dim far particles

  void main() {
    // gl_PointCoord: [0,1] with (0.5,0.5) center
    vec2 coord = gl_PointCoord - 0.5;
    float r    = length(coord);

    // Discard outside circle
    if (r > 0.5) discard;

    // Soft circular glow falloff — bright center, fade to edge
    float glow = 1.0 - smoothstep(0.0, 0.5, r);
    glow = glow * glow;  // sharper falloff

    // Color: bright white-lime when close to singularity center (vDist~0),
    //        signal lime mid-range, dim lime for outer particles
    vec3 color = mix(SIGNAL_BRIGHT, SIGNAL,     smoothstep(0.0, 0.25, vDist));
    color      = mix(color,         SIGNAL_DIM, smoothstep(0.25, 1.0, vDist));

    float alpha = glow * vOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────

interface ParticleFieldProps {
  state: AIState;
  energy?: number;
  audio?: number;
}

export function ParticleField({ state, energy = 0.5, audio = 0.0 }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  // Build static per-particle attributes once
  const { geometry, uniforms } = useMemo(() => {
    const positions = new Float32Array(MAX_PARTICLES * 3);  // not used — computed in shader
    const aSize     = new Float32Array(MAX_PARTICLES);
    const aOpacity  = new Float32Array(MAX_PARTICLES);
    const aSpeed    = new Float32Array(MAX_PARTICLES);
    const aPhase    = new Float32Array(MAX_PARTICLES);
    const aRadius   = new Float32Array(MAX_PARTICLES);
    const aAngle    = new Float32Array(MAX_PARTICLES);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      // Random orbit radius 0.5–4.0
      aRadius[i]  = 0.5 + Math.random() * 3.5;
      // Random starting angle
      aAngle[i]   = Math.random() * Math.PI * 2;
      // Orbit speed: faster close to center (Keplerian-ish), with variation
      const r_i   = aRadius[i] as number;
      const baseSpeed = 0.15 + (1.0 / (r_i + 0.3)) * 0.4;
      aSpeed[i]   = (Math.random() > 0.5 ? 1 : -1) * (baseSpeed + Math.random() * 0.08);
      // Random phase for vertical oscillation
      aPhase[i]   = Math.random() * Math.PI * 2;
      // Size: larger closer to center
      aSize[i]    = 2.5 + Math.random() * 4.5 - r_i * 0.6;
      aSize[i]    = Math.max(aSize[i] as number, 1.2);
      // Opacity varies
      aOpacity[i] = 0.4 + Math.random() * 0.6;

      // Positions start at origin — the vertex shader computes real position
      positions[i * 3]     = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize",    new THREE.BufferAttribute(aSize,    1));
    geo.setAttribute("aOpacity", new THREE.BufferAttribute(aOpacity, 1));
    geo.setAttribute("aSpeed",   new THREE.BufferAttribute(aSpeed,   1));
    geo.setAttribute("aPhase",   new THREE.BufferAttribute(aPhase,   1));
    geo.setAttribute("aRadius",  new THREE.BufferAttribute(aRadius,  1));
    geo.setAttribute("aAngle",   new THREE.BufferAttribute(aAngle,   1));

    const u = {
      uTime:   { value: 0.0 },
      uEnergy: { value: energy },
      uAudio:  { value: audio },
    };

    return { geometry: geo, uniforms: u };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update draw range when state changes
  useEffect(() => {
    if (!pointsRef.current) return;
    const drawCount: number = STATE_DRAW_RANGE[state];
    pointsRef.current.geometry.setDrawRange(0, drawCount);
  }, [state]);

  // Per-frame: advance time, lerp energy/audio
  useFrame((_, dt) => {
    if (!pointsRef.current) return;
    const u = (pointsRef.current.material as THREE.ShaderMaterial).uniforms as typeof uniforms;
    u.uTime.value  += dt;
    u.uEnergy.value += (energy - u.uEnergy.value) * 0.06;
    u.uAudio.value  += (audio  - u.uAudio.value)  * 0.12;
  });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader:   VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms,
        transparent:  true,
        depthWrite:   false,
        blending:     THREE.AdditiveBlending,
        vertexColors: false,
      }),
    [uniforms]
  );

  // Set initial draw range
  geometry.setDrawRange(0, STATE_DRAW_RANGE[state]);

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
    />
  );
}
