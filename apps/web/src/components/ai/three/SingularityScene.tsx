"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { EventHorizon } from "./EventHorizon";
import { ParticleField } from "./ParticleField";
import type { AIState } from "../store/aiStore";

// ─────────────────────────────────────────────────────────────────────────────
// SingularityScene — full singularity composition
//
// Combines EventHorizon + ParticleField in a slowly rotating group.
// Camera: positioned at [0, 2.8, 0] looking straight down at the singularity.
// Postprocessing: Bloom (intensity driven by energy) + Vignette.
//
// Usage: render inside a <Canvas> with camera={{ position: [0, 2.8, 0] }}
// ─────────────────────────────────────────────────────────────────────────────

// Energy value per AI state — drives visual intensity
const STATE_ENERGY: Record<AIState, number> = {
  dormant:    0.12,
  activating: 1.0,
  listening:  0.5,
  thinking:   0.95,
  speaking:   0.88,
  retrieving: 0.8,
  navigating: 0.9,
  focused:    0.6,
};

// Rotation speed per state (rad/s)
const STATE_ROTATION_SPEED: Record<AIState, number> = {
  dormant:    0.04,
  activating: 0.35,
  listening:  0.08,
  thinking:   0.28,
  speaking:   0.20,
  retrieving: 0.16,
  navigating: 0.40,
  focused:    0.10,
};

interface SingularitySceneProps {
  state: AIState;
  audioLevel?: number;
}

// ── Inner group component — handles rotation ──────────────────────────────────
function SingularityGroup({ state, audioLevel = 0.0 }: SingularitySceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const energy: number   = STATE_ENERGY[state];
  const rotSpeed: number = STATE_ROTATION_SPEED[state];

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    // Slow Y rotation — gives the sense of a slowly spinning accretion disk
    groupRef.current.rotation.y += rotSpeed * dt;
  });

  return (
    <group ref={groupRef}>
      {/* Event horizon lying flat in the XZ plane */}
      <EventHorizon energy={energy} audio={audioLevel} />

      {/* Orbital particle field */}
      <ParticleField state={state} energy={energy} audio={audioLevel} />
    </group>
  );
}

// ── Scene root — exported, intended for use inside a Canvas ──────────────────
export function SingularityScene({ state, audioLevel = 0.0 }: SingularitySceneProps) {
  const energy: number = STATE_ENERGY[state];

  // Bloom intensity scales with energy: base 0.6, max ~1.4
  const bloomIntensity = 0.6 + energy * 0.8;

  return (
    <>
      <SingularityGroup state={state} audioLevel={audioLevel} />

      <EffectComposer>
        {/* Bloom: liminal glow bleeding from hot accretion disk + particle cores */}
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.3}
          luminanceSmoothing={0.9}
          mipmapBlur={true}
        />
        {/* Vignette: darkens edges to focus attention on the singularity */}
        <Vignette
          offset={0.25}
          darkness={0.9}
          eskil={false}
        />
      </EffectComposer>
    </>
  );
}

// ── Camera setup helper — exported for use by parent Canvas ──────────────────
// Place camera at [0, 2.8, 0] looking down (-Y axis) at the singularity plane.
// Call this inside <Canvas camera={{ position: [0, 2.8, 0], up: [0, 0, -1] }}>
// or use the CameraRig below.
export function SingularityCameraRig() {
  // Static camera pointed straight down — no animation needed.
  // The camera is set via Canvas props so this component is a no-op mount guard.
  return null;
}
