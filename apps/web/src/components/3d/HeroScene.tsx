"use client";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { getOnlineCount, subscribeOnlineCount } from "@/lib/online-visitors";

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(mq.matches);
    const h = (e: MediaQueryListEvent) => setR(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return r;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

// ── Design tokens ────────────────────────────────────────────────────────────
const C_SIGNAL   = new THREE.Color(0xC6FF3A); // signal-lime
const C_TEXT_MID = new THREE.Color(0x99A2B2); // node resting colour
const C_TEXT_LO  = new THREE.Color(0x5C6573); // edge colour
const C_HOVER    = new THREE.Color(0xC6FF3A); // hover = full lime

// ── Tech-stack map (§D.6b) ────────────────────────────────────────────────────
// Each node maps to its real tech layer so hovering reveals the stack decision.
const TECH_MAP: Record<string, { label: string; techs: string[] }> = {
  client:    { label: "CLIENT",      techs: ["Next.js 14 App Router", "React 18", "TypeScript strict", "Tailwind CSS"] },
  gateway:   { label: "API GATEWAY", techs: ["NestJS", "class-validator", "Swagger / OpenAPI", "Global ValidationPipe"] },
  auth:      { label: "AUTH",        techs: ["JWT (RS256)", "httpOnly cookies", "NestJS Guards", "Bcrypt"] },
  postgres:  { label: "POSTGRES",    techs: ["PostgreSQL 16", "Prisma ORM", "pgvector (1536-dim)", "ISR revalidation tags"] },
  redis:     { label: "REDIS",       techs: ["Redis 7", "Token blacklist", "Rate-limit counters", "Session cache"] },
  queue:     { label: "QUEUE",       techs: ["Bull (Redis-backed)", "NestJS queues", "Job retry + backoff", "DLQ"] },
  worker:    { label: "WORKER",      techs: ["NestJS worker module", "RAG pipeline", "Prisma (read replicas)", "Streaming SSE"] },
  llm:       { label: "LLM",         techs: ["DeepSeek V4 Flash", "LLMProvider port (DI)", "DeepSeekAdapter", "Swappable via env"] },
  vectordb:  { label: "VECTOR DB",   techs: ["pgvector extension", "HNSW index", "1536-dim embeddings", "Cosine similarity"] },
  websocket: { label: "WEBSOCKET",   techs: ["Socket.IO", "NestJS Gateways", "Live visitor count", "Analytics RT push"] },
  cache:     { label: "CACHE",       techs: ["Redis cache layer", "ISR + on-demand revalidation", "stale-while-revalidate", "Cache-Control headers"] },
  storage:   { label: "STORAGE",     techs: ["S3-compatible (Contabo)", "Presigned URLs", "Asset pipeline", "CDN-ready"] },
};

// ── Composition constants — SINGLE SOURCE OF TRUTH ───────────────────────────
// Changing GRAPH_X_OFFSET moves the whole constellation; camera.x moves with it.
// This prevents the "graph drifts back into headline" regression.
const GRAPH_X_OFFSET = 4.0;   // world-units right from origin
const CAMERA_X      = -2.8;   // camera looks from the left to frame the right side
const CAMERA_Y      = 0.5;
const CAMERA_Z      = 10;
const CAMERA_FOV    = 56;

// ── Graph data — wider spread, rightmost layout ───────────────────────────────
// Positions are GROUP-RELATIVE (before GRAPH_X_OFFSET is applied).
// CLIENT at x=-4.5 ends up at world x=-0.5 after offset — clear of the
// headline which ends around world x=-1.5 at this camera/fov combination.
const NODES = [
  // CLIENT is in the text safe zone — no label, tooltip still shows on hover
  { id: "client",    label: "CLIENT",      pos: [-4.5,  0.1,  1.5] as [number, number, number], showLabel: false },
  // All other nodes are right of the headline — show labels
  { id: "gateway",   label: "GATEWAY",     pos: [-2.6,  0.2,  0.6] as [number, number, number], showLabel: true  },
  { id: "auth",      label: "AUTH",        pos: [-0.8,  2.6,  0.1] as [number, number, number], showLabel: true  },
  { id: "postgres",  label: "POSTGRES",    pos: [ 2.2, -0.5, -0.8] as [number, number, number], showLabel: true  },
  { id: "redis",     label: "REDIS",       pos: [ 1.2,  2.2, -0.3] as [number, number, number], showLabel: true  },
  { id: "queue",     label: "QUEUE",       pos: [-0.5, -2.2, -0.9] as [number, number, number], showLabel: true  },
  { id: "worker",    label: "WORKER",      pos: [ 1.8, -3.0, -1.6] as [number, number, number], showLabel: true  },
  { id: "llm",       label: "LLM",         pos: [ 3.4,  0.9, -2.2] as [number, number, number], showLabel: true  },
  { id: "vectordb",  label: "VECTOR DB",   pos: [ 2.8, -2.2, -2.4] as [number, number, number], showLabel: true  },
  { id: "websocket", label: "WS",          pos: [-2.4, -1.4, -0.5] as [number, number, number], showLabel: true  },
  { id: "cache",     label: "CACHE",       pos: [-0.8,  3.0, -1.0] as [number, number, number], showLabel: true  },
  { id: "storage",   label: "STORAGE",     pos: [ 1.2, -3.5, -2.0] as [number, number, number], showLabel: true  },
];

const NODE_POS: Record<string, THREE.Vector3> = {};
NODES.forEach((n) => { NODE_POS[n.id] = new THREE.Vector3(...n.pos); });

// Nodes whose group-relative X < -1 → tooltip opens RIGHT (away from text zone)
// Any node with pos[0] < -1.0 is near the left side of the graph
const LEFT_NODES = new Set(["client", "gateway", "websocket", "cache"]);

const EDGES: [string, string][] = [
  ["client",   "gateway"],
  ["gateway",  "auth"],
  ["gateway",  "postgres"],
  ["gateway",  "queue"],
  ["gateway",  "websocket"],
  ["gateway",  "cache"],
  ["auth",     "redis"],
  ["auth",     "postgres"],
  ["queue",    "worker"],
  ["worker",   "llm"],
  ["worker",   "storage"],
  ["llm",      "vectordb"],
  ["redis",    "cache"],
  ["postgres", "cache"],
];

// Build a per-node adjacency set for edge-highlight
const NODE_EDGES: Record<string, Set<string>> = {};
NODES.forEach((n) => { NODE_EDGES[n.id] = new Set(); });
EDGES.forEach(([a, b]) => {
  NODE_EDGES[a]!.add(b);
  NODE_EDGES[b]!.add(a);
});

// Realistic request flows through the system
const REQUEST_PATHS = [
  ["client", "gateway", "auth", "redis"],
  ["client", "gateway", "postgres"],
  ["client", "gateway", "auth", "postgres"],
  ["client", "gateway", "queue", "worker", "llm", "vectordb"],
  ["client", "gateway", "websocket"],
  ["client", "gateway", "cache"],
  ["client", "gateway", "queue", "worker", "storage"],
  ["client", "gateway", "auth", "redis", "cache"],
];

// ── Mobile critical-path graph (< 768px) ─────────────────────────────────────
// 4 core nodes only — CLIENT→GATEWAY→LLM→VECTOR DB tells the key story.
// Compact, centered, shifted down so it clears the text block on narrow screens.
const MOBILE_GRAPH_Y    = -1.6;   // push graph below the headline/CTA zone
const MOBILE_CAMERA_POS = [0, 0.8, 5.0] as [number, number, number];
const MOBILE_CAMERA_FOV = 62;

const MOBILE_NODES = [
  { id: "client",   label: "CLIENT",   pos: [-2.0,  0.2,  0.0] as [number, number, number], showLabel: true  },
  { id: "gateway",  label: "GATEWAY",  pos: [ 0.0,  0.0,  0.0] as [number, number, number], showLabel: true  },
  { id: "llm",      label: "LLM",      pos: [ 1.4,  1.0, -0.4] as [number, number, number], showLabel: true  },
  { id: "vectordb", label: "VECTOR DB",pos: [ 1.4, -1.0, -0.4] as [number, number, number], showLabel: true  },
  { id: "redis",    label: "REDIS",    pos: [-0.2,  1.4, -0.3] as [number, number, number], showLabel: true  },
];

const MOBILE_NODE_POS: Record<string, THREE.Vector3> = {};
MOBILE_NODES.forEach((n) => { MOBILE_NODE_POS[n.id] = new THREE.Vector3(...n.pos); });

const MOBILE_EDGES: [string, string][] = [
  ["client",  "gateway"],
  ["gateway", "llm"],
  ["gateway", "redis"],
  ["llm",     "vectordb"],
];

const MOBILE_REQUEST_PATHS = [
  ["client", "gateway", "llm", "vectordb"],
  ["client", "gateway", "redis"],
  ["client", "gateway", "llm"],
];

const MOBILE_MAX_PULSES  = 2;
const MOBILE_SPAWN_INT   = 2.5;
const MOBILE_LEFT_NODES  = new Set(["client"]);

// ── Pulse config ─────────────────────────────────────────────────────────────
const HOP_DURATION    = 1.2; // seconds per edge — calm, deliberate
const MAX_PULSES      = 4;
const SPAWN_INTERVAL  = 2.2; // seconds between new pulses
const REQUEST_SEED    = 0; // replaced by live fetch; 0 until API responds

// ── usePulseSource — returns live online count from SessionTracker's socket ───
function usePulseSource(): number {
  const [count, setCount] = useState(getOnlineCount());
  useEffect(() => subscribeOnlineCount(setCount), []);
  return count;
}

// ── Precomputed edge geometry (for static/reduced scene only) ─────────────────
function buildEdgeGeo() {
  const verts: number[] = [];
  EDGES.forEach(([a, b]) => {
    const pa = NODE_POS[a]!, pb = NODE_POS[b]!;
    verts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return g;
}

// ── NodeTooltip — drei Html overlay (§D.6b) ───────────────────────────────────
function NodeTooltip({ nodeId, side }: { nodeId: string; side: "left" | "right" }) {
  const info = TECH_MAP[nodeId];
  if (!info) return null;
  const align = side === "right" ? "left" : "right";
  return (
    <Html
      position={[0, 0, 0]}
      center={false}
      zIndexRange={[10, 0]}
      style={{
        pointerEvents: "none",
        userSelect: "none",
        transform: side === "right" ? "translate(20px, -50%)" : "translate(calc(-100% - 20px), -50%)",
      }}
    >
      <div
        style={{
          background: "#0F1218",
          border: "1px solid #1E2430",
          borderRadius: "8px",
          padding: "8px 10px",
          minWidth: "140px",
          textAlign: align as "left" | "right",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
            fontSize: "9px",
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: "#C6FF3A",
            marginBottom: "5px",
          }}
        >
          {info.label}
        </div>
        {info.techs.map((t) => (
          <div
            key={t}
            style={{
              fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
              fontSize: "8px",
              color: "#99A2B2",
              lineHeight: "1.5",
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </Html>
  );
}

// ── SystemGraph — the core scene ─────────────────────────────────────────────
function SystemGraph() {
  const onlineCount = usePulseSource();
  const prevCountRef = useRef(onlineCount);

  const groupRef   = useRef<THREE.Group>(null);
  const meshRefs   = useRef<Record<string, THREE.Mesh>>({});
  const nodeGlow   = useRef<Record<string, number>>({});
  const hoverNode  = useRef<string | null>(null);
  const pulses     = useRef<{ id: number; path: string[]; hop: number; progress: number; slot: number }[]>([]);
  const slots      = useRef([0, 1, 2, 3]);
  const slotOf     = useRef<Record<number, number>>({});
  const pulseRefs  = useRef<(THREE.Mesh | null)[]>(Array(MAX_PULSES).fill(null));
  const edgeRefs   = useRef<(THREE.LineSegments | null)[]>(Array(EDGES.length).fill(null));
  const lastSpawn  = useRef(0);
  const pulseId    = useRef(0);
  const tmpVec     = useMemo(() => new THREE.Vector3(), []);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Per-edge geometries (stable refs, created once)
  const edgeGeos = useMemo(() =>
    EDGES.map(([a, b]) => {
      const pa = NODE_POS[a]!, pb = NODE_POS[b]!;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(
        [pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], 3,
      ));
      return g;
    }),
  []);

  useEffect(() => {
    NODES.forEach((n) => { nodeGlow.current[n.id] = 0; });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.035;
      groupRef.current.position.y = Math.sin(t * 0.28) * 0.07;
    }

    // When a new visitor connects (real WebSocket signal), immediately spawn a
    // "client → gateway → llm" pulse representing that arrival.
    if (onlineCount > prevCountRef.current && pulses.current.length < MAX_PULSES && slots.current.length > 0) {
      const path = ["client", "gateway", "llm"];
      const id   = pulseId.current++;
      const slot = slots.current.pop()!;
      pulses.current.push({ id, path, hop: 0, progress: 0, slot });
      slotOf.current[id] = slot;
      nodeGlow.current["client"] = 1;
      lastSpawn.current = t;
    }
    prevCountRef.current = onlineCount;

    // Spawn simulated pulse on interval (background ambient traffic)
    if (
      t - lastSpawn.current > SPAWN_INTERVAL &&
      pulses.current.length < MAX_PULSES &&
      slots.current.length > 0
    ) {
      const path = REQUEST_PATHS[Math.floor(Math.random() * REQUEST_PATHS.length)]!;
      const id   = pulseId.current++;
      const slot = slots.current.pop()!;
      pulses.current.push({ id, path, hop: 0, progress: 0, slot });
      slotOf.current[id] = slot;
      nodeGlow.current[path[0]!] = Math.min(1, (nodeGlow.current[path[0]!] || 0) + 0.5);
      lastSpawn.current = t;
    }

    // Determine which edges connect to hovered node
    const h = hoverNode.current;
    const connectedEdges = new Set<number>();
    if (h) {
      EDGES.forEach(([a, b], i) => { if (a === h || b === h) connectedEdges.add(i); });
    }

    // Update edge materials based on hover
    EDGES.forEach(([, ], i) => {
      const line = edgeRefs.current[i];
      if (!line) return;
      const mat = line.material as THREE.LineBasicMaterial;
      if (h === null) {
        mat.color.set(C_TEXT_LO);
        mat.opacity = 0.35;
      } else if (connectedEdges.has(i)) {
        mat.color.set(C_HOVER);
        mat.opacity = 0.75;
      } else {
        mat.color.set(C_TEXT_LO);
        mat.opacity = 0.12;
      }
    });

    // Update node meshes
    NODES.forEach((n) => {
      nodeGlow.current[n.id] = Math.max(0, (nodeGlow.current[n.id] || 0) - 0.022);
      const mesh = meshRefs.current[n.id];
      if (!mesh) return;
      const isHovered   = h === n.id;
      const isConnected = h !== null && NODE_EDGES[h]?.has(n.id);
      const g = nodeGlow.current[n.id] ?? 0;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (isHovered) {
        mat.color.set(C_HOVER);
        mat.emissiveIntensity = 3.0;
        mesh.scale.setScalar(1.35);
      } else if (isConnected) {
        mat.color.set(C_HOVER);
        mat.emissiveIntensity = 1.2;
        mesh.scale.setScalar(1.12);
      } else {
        mat.color.set(C_TEXT_MID);
        mat.emissiveIntensity = g * 2.5;
        mesh.scale.setScalar(1 + g * 0.25);
      }
    });

    // Advance pulses
    const done: number[] = [];
    pulses.current.forEach((pulse) => {
      pulse.progress += 0.016 / HOP_DURATION;
      if (pulse.progress >= 1) {
        const arrivedId = pulse.path[pulse.hop + 1];
        if (arrivedId) nodeGlow.current[arrivedId] = 1;
        pulse.hop++;
        pulse.progress = 0;
        if (pulse.hop >= pulse.path.length - 1) {
          const pMesh = pulseRefs.current[pulse.slot];
          if (pMesh) pMesh.visible = false;
          slots.current.push(pulse.slot);
          delete slotOf.current[pulse.id];
          done.push(pulse.id);
          return;
        }
      }
      const from = NODE_POS[pulse.path[pulse.hop]!];
      const to   = NODE_POS[pulse.path[pulse.hop + 1]!];
      if (!from || !to) return;
      tmpVec.lerpVectors(from, to, pulse.progress);
      const pMesh = pulseRefs.current[pulse.slot];
      if (pMesh) { pMesh.position.copy(tmpVec); pMesh.visible = true; }
    });
    if (done.length) pulses.current = pulses.current.filter((p) => !done.includes(p.id));
  });

  const handlePointerEnter = useCallback((nodeId: string) => {
    hoverNode.current = nodeId;
    setHoveredId(nodeId);
    nodeGlow.current[nodeId] = Math.min(1, (nodeGlow.current[nodeId] || 0) + 0.6);
  }, []);

  const handlePointerLeave = useCallback(() => {
    hoverNode.current = null;
    setHoveredId(null);
  }, []);

  return (
    <group ref={groupRef} position={[GRAPH_X_OFFSET, 0.2, 0]}>
      {/* ── Per-edge lines (individually ref'd for hover highlight) ── */}
      {EDGES.map((_, i) => (
        <lineSegments
          key={`edge-${i}`}
          geometry={edgeGeos[i]!}
          ref={(el) => { edgeRefs.current[i] = el; }}
        >
          <lineBasicMaterial color={C_TEXT_LO} transparent opacity={0.35} />
        </lineSegments>
      ))}

      {/* ── Nodes ────────────────────────────────────────────────── */}
      {NODES.map((node) => {
        const tooltipSide: "left" | "right" = LEFT_NODES.has(node.id) ? "right" : "left";
        return (
          <mesh
            key={node.id}
            position={node.pos}
            ref={(el) => { if (el) meshRefs.current[node.id] = el; }}
            onPointerEnter={(e) => { e.stopPropagation(); handlePointerEnter(node.id); }}
            onPointerLeave={(e) => { e.stopPropagation(); handlePointerLeave(); }}
          >
            <icosahedronGeometry args={[0.12, 1]} />
            <meshStandardMaterial
              color={C_TEXT_MID}
              emissive={C_SIGNAL}
              emissiveIntensity={0}
              toneMapped={false}
            />
            {node.showLabel && (
              <Html
                position={[0, 0.30, 0]}
                center
                distanceFactor={10}
                zIndexRange={[10, 0]}
                style={{
                  fontSize: "9px",
                  fontFamily: "'JetBrains Mono','Geist Mono',monospace",
                  color: "#99A2B2",
                  letterSpacing: "0.09em",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  userSelect: "none",
                  background: "rgba(15,18,24,0.65)",
                  padding: "1px 5px",
                  borderRadius: "2px",
                }}
              >
                {node.label}
              </Html>
            )}
            {hoveredId === node.id && (
              <NodeTooltip nodeId={node.id} side={tooltipSide} />
            )}
          </mesh>
        );
      })}

      {/* ── Pulse spheres (pre-allocated slots) ───────────────────── */}
      {Array.from({ length: MAX_PULSES }, (_, slot) => (
        <mesh
          key={`pulse-${slot}`}
          ref={(el) => { pulseRefs.current[slot] = el; }}
          visible={false}
        >
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial
            color={C_SIGNAL}
            emissive={C_SIGNAL}
            emissiveIntensity={4}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Static fallback (reduced-motion) ─────────────────────────────────────────
function StaticConstellation() {
  return (
    <group position={[GRAPH_X_OFFSET, 0.2, 0]} rotation={[0.08, 0.25, 0]}>
      {NODES.map((node) => (
        <mesh key={node.id} position={node.pos}>
          <icosahedronGeometry args={[0.1, 1]} />
          <meshStandardMaterial color={C_TEXT_MID} />
        </mesh>
      ))}
      <lineSegments geometry={buildEdgeGeo()}>
        <lineBasicMaterial color={C_TEXT_LO} transparent opacity={0.25} />
      </lineSegments>
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <ambientLight intensity={0.4} />
    </group>
  );
}

// ── Mobile graph — critical path only ────────────────────────────────────────
function MobileSystemGraph() {
  const onlineCount  = usePulseSource();
  const prevCountRef = useRef(onlineCount);
  const groupRef  = useRef<THREE.Group>(null);
  const meshRefs  = useRef<Record<string, THREE.Mesh>>({});
  const nodeGlow  = useRef<Record<string, number>>({});
  const hoverNode = useRef<string | null>(null);
  const pulses    = useRef<{ id: number; path: string[]; hop: number; progress: number; slot: number }[]>([]);
  const slots     = useRef([0, 1]);
  const slotOf    = useRef<Record<number, number>>({});
  const pulseRefs = useRef<(THREE.Mesh | null)[]>(Array(MOBILE_MAX_PULSES).fill(null));
  const edgeRefs  = useRef<(THREE.LineSegments | null)[]>(Array(MOBILE_EDGES.length).fill(null));
  const lastSpawn = useRef(0);
  const pulseId   = useRef(0);
  const tmpVec    = useMemo(() => new THREE.Vector3(), []);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const edgeGeos = useMemo(() => MOBILE_EDGES.map(([a, b]) => {
    const pa = MOBILE_NODE_POS[a]!, pb = MOBILE_NODE_POS[b]!;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([pa.x,pa.y,pa.z,pb.x,pb.y,pb.z], 3));
    return g;
  }), []);

  useEffect(() => { MOBILE_NODES.forEach((n) => { nodeGlow.current[n.id] = 0; }); }, []);

  const handleEnter = useCallback((id: string) => { hoverNode.current = id; setHoveredId(id); }, []);
  const handleLeave = useCallback(() => { hoverNode.current = null; setHoveredId(null); }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.03;
      groupRef.current.position.y = MOBILE_GRAPH_Y + Math.sin(t * 0.25) * 0.05;
    }

    if (onlineCount > prevCountRef.current && pulses.current.length < MOBILE_MAX_PULSES && slots.current.length > 0) {
      const path = MOBILE_REQUEST_PATHS[0]!;
      const id   = pulseId.current++;
      const slot = slots.current.pop()!;
      pulses.current.push({ id, path, hop: 0, progress: 0, slot });
      slotOf.current[id] = slot;
      nodeGlow.current[path[0]!] = 1;
      lastSpawn.current = t;
    }
    prevCountRef.current = onlineCount;

    if (t - lastSpawn.current > MOBILE_SPAWN_INT && pulses.current.length < MOBILE_MAX_PULSES && slots.current.length > 0) {
      const path = MOBILE_REQUEST_PATHS[Math.floor(Math.random() * MOBILE_REQUEST_PATHS.length)]!;
      const id   = pulseId.current++;
      const slot = slots.current.pop()!;
      pulses.current.push({ id, path, hop: 0, progress: 0, slot });
      slotOf.current[id] = slot;
      nodeGlow.current[path[0]!] = Math.min(1, (nodeGlow.current[path[0]!] || 0) + 0.6);
      lastSpawn.current = t;
    }

    const h = hoverNode.current;
    const connectedIdx = new Set<number>();
    if (h) MOBILE_EDGES.forEach(([a, b], i) => { if (a === h || b === h) connectedIdx.add(i); });

    MOBILE_EDGES.forEach((_, i) => {
      const line = edgeRefs.current[i];
      if (!line) return;
      const mat = line.material as THREE.LineBasicMaterial;
      mat.color.set(connectedIdx.has(i) ? C_SIGNAL : C_TEXT_LO);
      mat.opacity = connectedIdx.has(i) ? 0.75 : 0.5;
    });

    MOBILE_NODES.forEach((n) => {
      nodeGlow.current[n.id] = Math.max(0, (nodeGlow.current[n.id] || 0) - 0.02);
      const mesh = meshRefs.current[n.id];
      if (!mesh) return;
      const g = nodeGlow.current[n.id] ?? 0;
      const isHov = hoverNode.current === n.id;
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.max(g * 4, isHov ? 2.5 : 0);
      mesh.scale.setScalar(1 + Math.max(g * 0.35, isHov ? 0.15 : 0));
    });

    const done: number[] = [];
    pulses.current.forEach((pulse) => {
      pulse.progress += 0.016 / HOP_DURATION;
      if (pulse.progress >= 1) {
        const arrivedId = pulse.path[pulse.hop + 1];
        if (arrivedId) nodeGlow.current[arrivedId] = 1;
        pulse.hop++;
        pulse.progress = 0;
        if (pulse.hop >= pulse.path.length - 1) {
          const pm = pulseRefs.current[pulse.slot];
          if (pm) pm.visible = false;
          slots.current.push(pulse.slot);
          delete slotOf.current[pulse.id];
          done.push(pulse.id);
          return;
        }
      }
      const from = MOBILE_NODE_POS[pulse.path[pulse.hop]!];
      const to   = MOBILE_NODE_POS[pulse.path[pulse.hop + 1]!];
      if (!from || !to) return;
      tmpVec.lerpVectors(from, to, pulse.progress);
      const pm = pulseRefs.current[pulse.slot];
      if (pm) { pm.position.copy(tmpVec); pm.visible = true; }
    });
    if (done.length) pulses.current = pulses.current.filter((p) => !done.includes(p.id));
  });

  return (
    <group ref={groupRef} position={[0, MOBILE_GRAPH_Y, 0]}>
      {edgeGeos.map((geo, i) => (
        <lineSegments key={`m-edge-${i}`} geometry={geo} ref={(el) => { edgeRefs.current[i] = el; }}>
          <lineBasicMaterial color={C_TEXT_LO} transparent opacity={0.5} />
        </lineSegments>
      ))}
      {MOBILE_NODES.map((node) => {
        const side: "left" | "right" = MOBILE_LEFT_NODES.has(node.id) ? "right" : "left";
        return (
          <mesh key={node.id} position={node.pos}
            ref={(el) => { if (el) meshRefs.current[node.id] = el as THREE.Mesh; }}
            onPointerEnter={(e) => { e.stopPropagation(); handleEnter(node.id); }}
            onPointerLeave={(e) => { e.stopPropagation(); handleLeave(); }}
          >
            <icosahedronGeometry args={[0.15, 1]} />
            <meshStandardMaterial color={C_TEXT_MID} emissive={C_SIGNAL} emissiveIntensity={0} toneMapped={false} />
            {node.showLabel && (
              <Html position={[0, 0.30, 0]} center distanceFactor={8} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
                <span style={{ fontSize:"9px", fontFamily:"'JetBrains Mono',monospace", color:"#99A2B2", letterSpacing:"0.09em", whiteSpace:"nowrap", background:"rgba(15,18,24,0.65)", padding:"1px 5px", borderRadius:"2px" }}>
                  {node.label}
                </span>
              </Html>
            )}
            {hoveredId === node.id && <NodeTooltip nodeId={node.id} side={side} />}
          </mesh>
        );
      })}
      {Array.from({ length: MOBILE_MAX_PULSES }, (_, slot) => (
        <mesh key={`m-pulse-${slot}`} ref={(el) => { pulseRefs.current[slot] = el; }} visible={false}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={C_SIGNAL} emissive={C_SIGNAL} emissiveIntensity={5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function MobileStaticConstellation() {
  const edgeGeo = useMemo(() => {
    const verts: number[] = [];
    MOBILE_EDGES.forEach(([a, b]) => {
      const pa = MOBILE_NODE_POS[a]!, pb = MOBILE_NODE_POS[b]!;
      verts.push(pa.x,pa.y,pa.z,pb.x,pb.y,pb.z);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, []);
  return (
    <group position={[0, MOBILE_GRAPH_Y, 0]} rotation={[0.05, 0.2, 0]}>
      {MOBILE_NODES.map((n) => (
        <mesh key={n.id} position={n.pos}>
          <icosahedronGeometry args={[0.14, 1]} />
          <meshStandardMaterial color={C_TEXT_MID} />
        </mesh>
      ))}
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={C_TEXT_LO} transparent opacity={0.4} />
      </lineSegments>
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <ambientLight intensity={0.4} />
    </group>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function HeroScene() {
  const reduced      = useReducedMotion();
  const isMobile     = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const inViewRef    = useRef(true); // tracks IntersectionObserver state separately
  const [visible, setVisible] = useState(true);
  const [reqCount, setReqCount] = useState(REQUEST_SEED);
  const [onlineCount, setOnlineCount] = useState(getOnlineCount());

  useEffect(() => subscribeOnlineCount(setOnlineCount), []);

  // Seed the request counter from the real all-time page-view count on mount
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    fetch(`${apiUrl}/analytics/total-views`)
      .then((r) => (r.ok ? (r.json() as Promise<{ total: number }>) : null))
      .then((data) => {
        if (data?.total) setReqCount(data.total);
      })
      .catch(() => {
        // keep seed at 0 — non-fatal
      });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        inViewRef.current = e?.isIntersecting ?? false;
        setVisible(!document.hidden && inViewRef.current);
      },
      { threshold: 0 },
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    // Restore visibility when the user switches back to this tab
    const h = () => setVisible(!document.hidden && inViewRef.current);
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);

  return (
    // Container: pointer-events none so underlying text CTAs remain clickable.
    // Canvas inside uses pointerEvents: auto so mesh hover events fire normally.
    <div ref={containerRef} className="absolute inset-0" style={{ pointerEvents: "none" }}>
      {/* "You are request #N" live counter */}
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "6%",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "11px",
          color: "#5C6573",
          letterSpacing: "0.08em",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          pointerEvents: "none",
        }}
      >
        <span style={{ color: "#C6FF3A", fontSize: "8px" }}>●</span>
        {reqCount > 0 ? `LIVE — you are visitor #${reqCount.toLocaleString()}` : "LIVE"}
        {onlineCount > 0 && (
          <span style={{ marginLeft: "10px", opacity: 0.6 }}>
            · {onlineCount} online
          </span>
        )}
      </div>

      {reduced ? (
        // Reduced-motion: static constellation, no pulses, mobile-aware
        <Canvas
          camera={{ position: isMobile ? MOBILE_CAMERA_POS : [CAMERA_X, CAMERA_Y, CAMERA_Z], fov: isMobile ? MOBILE_CAMERA_FOV : CAMERA_FOV }}
          dpr={[1, 2]}
          gl={{ antialias: false, alpha: true }}
          style={{ background: "transparent", pointerEvents: "auto" }}
          frameloop="never"
        >
          <fog attach="fog" args={["#0A0C10", isMobile ? 4 : 5, isMobile ? 12 : 15]} />
          {isMobile ? <MobileStaticConstellation /> : <StaticConstellation />}
        </Canvas>
      ) : (
        visible && (
          <Canvas
            camera={{ position: isMobile ? MOBILE_CAMERA_POS : [CAMERA_X, CAMERA_Y, CAMERA_Z], fov: isMobile ? MOBILE_CAMERA_FOV : CAMERA_FOV }}
            dpr={[1, 2]}
            gl={{ antialias: false, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
            style={{ background: "transparent", pointerEvents: "auto" }}
            frameloop="always"
          >
            <fog attach="fog" args={["#0A0C10", isMobile ? 4 : 5, isMobile ? 12 : 15]} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <ambientLight intensity={0.45} />
            {isMobile ? <MobileSystemGraph /> : <SystemGraph />}
            <EffectComposer>
              <Bloom intensity={isMobile ? 0.35 : 0.4} luminanceThreshold={0.8} luminanceSmoothing={0.9} />
            </EffectComposer>
          </Canvas>
        )
      )}
    </div>
  );
}
