"use client";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// EventHorizon — GLSL event horizon shader plane
//
// Renders a black singularity void surrounded by:
//   - Accretion disk: bright signal-lime ring at the event horizon boundary
//   - Gravitational lensing: UV distortion pulling toward center
//   - Energy field: simplex-noise slow animation
//   - Horizon rim glow: soft lime halo edging the void
//   - Pure black void interior (voidMask)
//
// Uniforms: uTime (float), uEnergy (float), uAudio (float)
// Geometry: 6×6 Plane rotated -PI/2 on X (lies flat in XZ plane)
// ─────────────────────────────────────────────────────────────────────────────

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uEnergy;
  uniform float uAudio;
  varying vec2 vUv;

  // ── Simplex noise helpers ────────────────────────────────────────────────────
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1  = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0*fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314*(a0*a0+h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  // ────────────────────────────────────────────────────────────────────────────

  // Signal-lime color tokens
  // --signal: #C6FF3A  = vec3(0.776, 1.0, 0.227)
  // --signal-dim: #8FB82A = vec3(0.561, 0.722, 0.165)
  const vec3 SIGNAL      = vec3(0.776, 1.0, 0.227);
  const vec3 SIGNAL_DIM  = vec3(0.561, 0.722, 0.165);
  const vec3 SIGNAL_WARM = vec3(0.95,  1.0,  0.7);   // near-white hot core

  void main() {
    // Remap UVs to [-1, 1] centered
    vec2 uv = vUv * 2.0 - 1.0;

    // ── Gravitational lensing distortion ──────────────────────────────────────
    // Warp UVs toward center — simulates light bending near massive body
    float rawDist = length(uv);
    float lensStrength = 0.18 + uEnergy * 0.12 + uAudio * 0.06;
    // Stronger pull near center, taper off at edges
    float lensPull = lensStrength / (rawDist * rawDist + 0.04);
    vec2 lensedUv = uv + normalize(uv + 1e-6) * (-lensPull * 0.04);

    // Distance in lensed space
    float dist = length(lensedUv);

    // ── Void mask ─────────────────────────────────────────────────────────────
    // Pure black interior — inside event horizon nothing escapes
    float voidRadius = 0.13 + uAudio * 0.02;
    float voidMask   = 1.0 - smoothstep(voidRadius - 0.008, voidRadius + 0.008, dist);

    // ── Accretion disk ring ───────────────────────────────────────────────────
    // Bright lime ring just outside the void radius
    float diskInner = voidRadius + 0.008;
    float diskOuter = voidRadius + 0.055 + uEnergy * 0.04;
    float diskRing  = smoothstep(diskInner, diskInner + 0.012, dist)
                    * (1.0 - smoothstep(diskOuter - 0.012, diskOuter, dist));

    // Disk hot-spot: brighter on the "inner" edge, dims outward
    float diskHeat  = 1.0 - smoothstep(diskInner, diskOuter, dist);
    vec3  diskColor = mix(SIGNAL_DIM, SIGNAL_WARM, diskHeat * diskHeat);
    diskColor      *= 1.0 + uEnergy * 0.6 + uAudio * 0.4;

    // Rotating disk brightness variation — simulate turbulent plasma streams
    float diskAngle   = atan(lensedUv.y, lensedUv.x);
    float diskRipple  = 0.7 + 0.3 * sin(diskAngle * 6.0 + uTime * 1.8)
                           * sin(diskAngle * 3.0 - uTime * 1.1);
    diskColor        *= diskRipple;

    // ── Horizon rim glow ─────────────────────────────────────────────────────
    // Soft additive halo that bleeds outward from the edge of the void
    float rimWidth  = 0.10 + uEnergy * 0.06;
    float rimGlow   = smoothstep(voidRadius, voidRadius + rimWidth, dist)
                    * (1.0 - smoothstep(voidRadius + rimWidth, voidRadius + rimWidth * 2.5, dist));
    rimGlow        *= 0.5 + uEnergy * 0.5;
    vec3  rimColor  = mix(SIGNAL, SIGNAL_DIM, 0.4) * rimGlow;

    // ── Energy field noise ────────────────────────────────────────────────────
    // Slow-animated simplex noise creating organic energy turbulence
    // Applied in a band just outside accretion disk, fades to zero at edges
    vec2  noiseUv   = lensedUv * 3.5 + uTime * 0.12;
    float noiseA    = snoise(noiseUv);
    float noiseB    = snoise(noiseUv * 2.1 - uTime * 0.07);
    float noiseVal  = (noiseA * 0.6 + noiseB * 0.4) * 0.5 + 0.5;

    float noiseBand = smoothstep(diskOuter, diskOuter + 0.06, dist)
                    * (1.0 - smoothstep(0.55, 0.85, dist));
    float noiseIntensity = noiseVal * noiseBand * (0.15 + uEnergy * 0.25);
    vec3  noiseColor = SIGNAL_DIM * noiseIntensity;

    // ── Outer fade ────────────────────────────────────────────────────────────
    // Scene fades to full transparency at edges (plane blends with void backdrop)
    float outerFade = 1.0 - smoothstep(0.72, 1.0, dist);

    // ── Compose ───────────────────────────────────────────────────────────────
    // Start with zero (transparent black)
    vec3 color = vec3(0.0);

    // Add rim glow, disk, noise on top (all outside the void)
    float outsideMask = 1.0 - voidMask;
    color += rimColor  * outsideMask;
    color += diskColor * diskRing * outsideMask;
    color += noiseColor * outsideMask;

    // Void interior: absolute black (no additive contribution)
    // Alpha must be 1 inside void so it occludes the background
    float alpha = outsideMask * (rimGlow + diskRing + noiseIntensity) * outerFade
                + voidMask;  // void is fully opaque black

    // Clamp color — void region stays black
    color = color * outsideMask * outerFade;

    // Final alpha: at least partially opaque in void, additive elsewhere
    float finalAlpha = voidMask + (rimGlow * 0.8 + diskRing * 0.9 + noiseIntensity * 0.7)
                     * outsideMask * outerFade;
    finalAlpha = clamp(finalAlpha, 0.0, 1.0);

    gl_FragColor = vec4(color, finalAlpha);
  }
`;

interface EventHorizonProps {
  energy?: number;
  audio?: number;
}

export function EventHorizon({ energy = 0.5, audio = 0.0 }: EventHorizonProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime:   { value: 0.0 },
      uEnergy: { value: energy },
      uAudio:  { value: audio },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Sync energy/audio prop changes into uniforms
  useFrame((_, dt) => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms as typeof uniforms;
    u.uTime.value   += dt;
    // Smooth-lerp energy & audio so changes aren't abrupt
    u.uEnergy.value += (energy - u.uEnergy.value) * 0.08;
    u.uAudio.value  += (audio  - u.uAudio.value)  * 0.15;
  });

  return (
    // -PI/2 rotation on X lays the plane flat in XZ (top-down view)
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[6, 6, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
