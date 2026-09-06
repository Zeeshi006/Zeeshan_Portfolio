// Resume seed script — run with: node seed.mjs
// Reads Hammad_Afzal_Resume and POSTs to the local API

const API = "http://localhost:3001";
const EMAIL = "hammad.afzal.code@gmail.com";
const PASSWORD = "Admin@1234";

async function req(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── 1. Login ─────────────────────────────────────────────────────────────────
console.log("🔐 Logging in...");
const { access_token: TOKEN } = await req("POST", "/auth/login", {
  email: EMAIL,
  password: PASSWORD,
});
console.log("✓ Authenticated\n");

// ── 2. Skills ─────────────────────────────────────────────────────────────────
console.log("💡 Seeding skills...");
const SKILLS = [
  // Languages → backend category (closest match in our schema)
  {
    name: "TypeScript",
    category: "backend",
    proficiencyLevel: 5,
    sortOrder: 0,
  },
  {
    name: "JavaScript",
    category: "backend",
    proficiencyLevel: 5,
    sortOrder: 1,
  },
  { name: "Node.js", category: "backend", proficiencyLevel: 5, sortOrder: 2 },
  { name: "Python", category: "backend", proficiencyLevel: 3, sortOrder: 3 },
  { name: "SQL", category: "backend", proficiencyLevel: 4, sortOrder: 4 },
  { name: "NestJS", category: "backend", proficiencyLevel: 5, sortOrder: 5 },
  {
    name: "Express.js",
    category: "backend",
    proficiencyLevel: 5,
    sortOrder: 6,
  },
  { name: "Fastify", category: "backend", proficiencyLevel: 4, sortOrder: 7 },
  { name: "FastAPI", category: "backend", proficiencyLevel: 3, sortOrder: 8 },
  { name: "REST APIs", category: "backend", proficiencyLevel: 5, sortOrder: 9 },
  {
    name: "Swagger / OpenAPI",
    category: "backend",
    proficiencyLevel: 5,
    sortOrder: 10,
  },
  {
    name: "Microservices",
    category: "backend",
    proficiencyLevel: 4,
    sortOrder: 11,
  },

  // Frontend
  { name: "React", category: "frontend", proficiencyLevel: 4, sortOrder: 0 },
  { name: "Next.js", category: "frontend", proficiencyLevel: 4, sortOrder: 1 },
  {
    name: "Redux Toolkit",
    category: "frontend",
    proficiencyLevel: 4,
    sortOrder: 2,
  },
  {
    name: "Tailwind CSS",
    category: "frontend",
    proficiencyLevel: 4,
    sortOrder: 3,
  },
  { name: "MUI", category: "frontend", proficiencyLevel: 3, sortOrder: 4 },
  {
    name: "HTML5 / CSS3",
    category: "frontend",
    proficiencyLevel: 4,
    sortOrder: 5,
  },

  // Data & ORMs
  { name: "PostgreSQL", category: "data", proficiencyLevel: 5, sortOrder: 0 },
  { name: "MongoDB", category: "data", proficiencyLevel: 3, sortOrder: 1 },
  { name: "Redis", category: "data", proficiencyLevel: 4, sortOrder: 2 },
  { name: "TypeORM", category: "data", proficiencyLevel: 4, sortOrder: 3 },
  { name: "Prisma", category: "data", proficiencyLevel: 4, sortOrder: 4 },
  { name: "Mongoose", category: "data", proficiencyLevel: 3, sortOrder: 5 },
  { name: "Knex.js", category: "data", proficiencyLevel: 3, sortOrder: 6 },
  { name: "pgvector", category: "data", proficiencyLevel: 4, sortOrder: 7 },

  // Messaging & Real-time
  {
    name: "Socket.IO",
    category: "messaging",
    proficiencyLevel: 5,
    sortOrder: 0,
  },
  {
    name: "RabbitMQ",
    category: "messaging",
    proficiencyLevel: 4,
    sortOrder: 1,
  },
  {
    name: "Apache Kafka",
    category: "messaging",
    proficiencyLevel: 3,
    sortOrder: 2,
  },
  {
    name: "Azure Service Bus",
    category: "messaging",
    proficiencyLevel: 4,
    sortOrder: 3,
  },
  {
    name: "WebSockets",
    category: "messaging",
    proficiencyLevel: 5,
    sortOrder: 4,
  },

  // AI & Agents
  {
    name: "LLM Agents",
    category: "ai_agents",
    proficiencyLevel: 5,
    sortOrder: 0,
  },
  {
    name: "Tool / Function Calling",
    category: "ai_agents",
    proficiencyLevel: 5,
    sortOrder: 1,
  },
  {
    name: "OpenAI API",
    category: "ai_agents",
    proficiencyLevel: 4,
    sortOrder: 2,
  },
  {
    name: "DeepSeek",
    category: "ai_agents",
    proficiencyLevel: 4,
    sortOrder: 3,
  },
  {
    name: "ElevenLabs",
    category: "ai_agents",
    proficiencyLevel: 4,
    sortOrder: 4,
  },
  {
    name: "RAG Pipelines",
    category: "ai_agents",
    proficiencyLevel: 5,
    sortOrder: 5,
  },
  {
    name: "Self-learning KB",
    category: "ai_agents",
    proficiencyLevel: 5,
    sortOrder: 6,
  },
  {
    name: "Transcription Pipelines",
    category: "ai_agents",
    proficiencyLevel: 4,
    sortOrder: 7,
  },

  // Architecture & DevOps
  {
    name: "Clean Architecture",
    category: "architecture",
    proficiencyLevel: 5,
    sortOrder: 0,
  },
  {
    name: "Modular Monoliths",
    category: "architecture",
    proficiencyLevel: 5,
    sortOrder: 1,
  },
  {
    name: "Adapter Pattern",
    category: "architecture",
    proficiencyLevel: 5,
    sortOrder: 2,
  },
  {
    name: "Strategy Pattern",
    category: "architecture",
    proficiencyLevel: 4,
    sortOrder: 3,
  },
  {
    name: "SOLID / DRY",
    category: "architecture",
    proficiencyLevel: 5,
    sortOrder: 4,
  },
  {
    name: "Docker",
    category: "architecture",
    proficiencyLevel: 4,
    sortOrder: 5,
  },
  {
    name: "Turborepo / Lerna",
    category: "architecture",
    proficiencyLevel: 4,
    sortOrder: 6,
  },
  {
    name: "MFA / WebAuthn",
    category: "architecture",
    proficiencyLevel: 4,
    sortOrder: 7,
  },
  {
    name: "Stripe / Twilio",
    category: "architecture",
    proficiencyLevel: 3,
    sortOrder: 8,
  },
  {
    name: "CI/CD",
    category: "architecture",
    proficiencyLevel: 3,
    sortOrder: 9,
  },
];

for (const skill of SKILLS) {
  await req("POST", "/content/skills", skill, TOKEN);
  process.stdout.write(".");
}
console.log(`\n✓ ${SKILLS.length} skills seeded\n`);

// ── 3. Experience ─────────────────────────────────────────────────────────────
console.log("💼 Seeding experience...");
const EXPERIENCES = [
  {
    company: "TapTap Technologies",
    role: "Full Stack TypeScript Developer",
    startDate: "2025-12-01",
    endDate: null,
    summary:
      "Backend-leaning full-stack engineer on an AI-native Sales CRM (a Salesforce/HubSpot competitor) and a UK automotive sales platform, owning service architecture across NestJS modular monoliths and microservices with real-time and LLM-agent capabilities.",
    highlights: [
      "Own backend service architecture across NestJS modular monoliths and microservices, applying Clean Architecture and the Adapter pattern to keep core business domains isolated from third-party APIs.",
      "Lead delivery of the CRM's AI voice-agent capabilities end to end — inbound/outbound agents, LLM tool calling, and a self-learning knowledge base — coordinating across telephony, transcription, and CRM data.",
      "Integrate billing, security, and messaging infrastructure (Stripe, MFA, Redis, RabbitMQ) and partner with frontend on real-time React features surfacing agent activity and lead timelines.",
    ],
    sortOrder: 0,
  },
  {
    company: "Disrupt.com (via 360XpertSolutions)",
    role: "Full Stack Developer",
    startDate: "2025-06-01",
    endDate: "2025-12-01",
    summary:
      "Engineered full-stack solutions for the PureKeep password manager — secure vault sharing, roaming authenticators (passkeys), and standalone binaries for on-premises client deployments.",
    highlights: [
      "Orchestrated end-to-end cryptographic ceremonies (attestation & assertion) for a WebAuthn-compliant passkey provider using the native Web Crypto API.",
      "Architected the compilation of a Node.js server into a self-contained executable, safeguarding proprietary source code for secure on-premises enterprise deployments.",
      "Developed a secure E2EE sharing mechanism with cryptographic key wrapping for zero-knowledge transfer of vault items and large file attachments.",
    ],
    sortOrder: 1,
  },
  {
    company: "360XpertSolutions",
    role: "Full Stack Developer",
    startDate: "2023-11-01",
    endDate: "2025-06-01",
    summary:
      "Led full-stack development across 4 projects: an Inventory & Employee Management System, an E-invoicing System, a Parcel Delivery Platform (BYKEA), and the backend of an AI-powered Community App.",
    highlights: [
      "Implemented real-time communication with Socket.IO, designing for reliability with acknowledgments, retry logic, and seamless reconnection for fault-tolerant interactions.",
      "Applied Clean Architecture for maintainable, testable codebases and delivered structured REST APIs with clear Swagger documentation.",
      "Applied Strategy and other design patterns to implement dynamic business rules and extensible workflows, promoting DRY and improving flexibility, maintainability, and scalability.",
    ],
    sortOrder: 2,
  },
];

for (const exp of EXPERIENCES) {
  await req("POST", "/content/experiences", exp, TOKEN);
  process.stdout.write(".");
}
console.log(`\n✓ ${EXPERIENCES.length} experiences seeded\n`);

// ── 4. Projects ───────────────────────────────────────────────────────────────
console.log("🚀 Seeding projects...");
const PROJECTS = [
  {
    title: "Sales CRM — AI-Native",
    slug: "sales-crm-ai-native",
    tagline:
      "A Salesforce/HubSpot competitor with configurable inbound/outbound voice agents, self-learning KB, and real-time lead timelines.",
    techStack: [
      "NestJS",
      "TypeScript",
      "PostgreSQL",
      "MongoDB",
      "Redis",
      "RabbitMQ",
      "ElevenLabs",
      "Twilio",
      "OpenAI",
      "Socket.IO",
    ],
    outcomeMetric: "Full voice-agent CRM in production",
    status: "shipped",
    featured: true,
    sortOrder: 0,
  },
  {
    title: "Vanaways CRM",
    slug: "vanaways-crm",
    tagline:
      "Three modular-monolith portals for a UK mini-truck sales business — Quotation, Dealer, and Customer — with Azure Service Bus event flow.",
    techStack: [
      "NestJS",
      "TypeScript",
      "PostgreSQL",
      "TypeORM",
      "Azure Service Bus",
      "Socket.IO",
    ],
    outcomeMetric: "End-to-end sales journey including document signing",
    status: "shipped",
    featured: true,
    sortOrder: 1,
  },
  {
    title: "PureKeep — Password Manager",
    slug: "purekeep",
    tagline:
      "Phishing-resistant passkey provider, E2EE vault sharing, and self-contained binary for on-premises enterprise deployment.",
    techStack: [
      "Node.js",
      "TypeScript",
      "PostgreSQL",
      "Lerna Monorepo",
      "WebExtension API",
      "Web Crypto API",
    ],
    outcomeMetric: "Zero-knowledge E2EE + WebAuthn passkeys live",
    status: "shipped",
    featured: true,
    sortOrder: 2,
  },
  {
    title: "Community × AI App",
    slug: "community-ai-app",
    tagline:
      "Real-time social platform with word-by-word streaming LLM responses, full social post APIs, and RabbitMQ inter-service messaging.",
    techStack: [
      "Node.js",
      "NestJS",
      "PostgreSQL",
      "Knex.js",
      "Socket.IO",
      "Redis",
      "OpenAI",
      "RabbitMQ",
    ],
    outcomeMetric: "Streaming LLM chat + real-time social feed",
    status: "shipped",
    featured: false,
    sortOrder: 3,
  },
];

for (const project of PROJECTS) {
  await req("POST", "/content/projects", project, TOKEN);
  process.stdout.write(".");
}
console.log(`\n✓ ${PROJECTS.length} projects seeded\n`);

// ── 5. Case Study shells ──────────────────────────────────────────────────────
console.log("📚 Seeding case study shells...");
const CASE_STUDIES = [
  {
    slug: "ai-sales-crm-voice-agents",
    title: "AI-Native Sales CRM — Voice Agents & Self-Learning KB",
    context:
      "TapTap Technologies commissioned a full Salesforce/HubSpot competitor with AI voice agents at its core. My role was owning the entire backend architecture across NestJS modular monoliths and microservices, plus end-to-end delivery of the voice-agent and knowledge-base systems.",
    problem:
      "Sales agents needed to act on live calls with sub-second tool execution — scheduling meetings, taking notes, querying the CRM — while a self-learning system had to synthesize call transcripts into new KB articles automatically, growing the system's knowledge over time without human curation.",
    architectureDiagram: "",
    keyDecisions: [
      {
        title: "RabbitMQ over Kafka for agent event bus",
        chosen: "RabbitMQ",
        alternative: "Apache Kafka",
        rationale:
          "Lower operational overhead for the traffic volume, faster queue-per-agent isolation, and native NestJS queue support. Kafka's throughput guarantees were unnecessary at this scale.",
      },
      {
        title: "LLMProvider adapter port for model swappability",
        chosen: "Adapter pattern — LLMProvider port",
        alternative: "Direct OpenAI SDK calls",
        rationale:
          "Decouples business logic from any specific LLM vendor. Swapping models (OpenAI → DeepSeek → any future model) requires only a new adapter, zero changes to use-cases.",
      },
      {
        title: "Per-agent knowledge base over shared global KB",
        chosen: "Per-agent KB with synthesis pipeline",
        alternative: "Single shared knowledge base",
        rationale:
          "Agents serve different personas and product lines. Per-agent KB prevents cross-contamination and allows specialized knowledge growth. Synthesis from transcripts runs async via worker queues.",
      },
    ],
    hardParts:
      "The hardest part was the self-learning KB loop: ingesting call transcripts → chunking → embedding → similarity dedup → synthesizing a coherent new KB article via LLM → storing with vector index. The dedup step required cosine similarity thresholds tuned to avoid both duplicate noise and missed near-duplicates. The second hard part was the real-time meeting agent (Vexa integration) — streaming live suggestions to reps mid-call with sub-second latency while the main call transcript was being assembled.",
    outcome:
      "Full AI-native CRM shipped to production. Voice agents handle inbound/outbound calls with configurable ElevenLabs voices, LLM function calling for CRM actions, and a KB that grows with every call. The debrief agent auto-creates targeted LMS skill tasks after each call.",
    published: false,
    sortOrder: 0,
  },
  {
    slug: "purekeep-webauthn-e2ee",
    title: "PureKeep — WebAuthn Passkeys & E2EE Vault Sharing",
    context:
      "Disrupt.com needed a phishing-resistant password manager with passkey support and E2EE vault sharing — plus a self-contained binary for enterprise clients who require full data sovereignty and cannot use cloud deployments.",
    problem:
      "Three distinct hard problems in one project: (1) implement a full WebAuthn passkey provider from scratch using native Web Crypto API with correct attestation/assertion ceremonies, (2) architect E2EE sharing that extends beyond organizational boundaries with zero-knowledge guarantees, and (3) compile a Node.js server into a single executable with proprietary source protection.",
    architectureDiagram: "",
    keyDecisions: [
      {
        title: "Native Web Crypto API over passport-fido2 libraries",
        chosen: "Native Web Crypto API",
        alternative: "passport-fido2 / simplewebauthn",
        rationale:
          "Full control over the cryptographic ceremonies — attestation format parsing, counter verification, and credential storage. Libraries abstract too much and have audit surface concerns for a security product.",
      },
      {
        title: "Key wrapping for E2EE cross-boundary sharing",
        chosen: "Asymmetric key wrapping (recipient's public key)",
        alternative: "Shared symmetric key via secure channel",
        rationale:
          "Recipient-keyed wrapping preserves zero-knowledge: the server never sees the unwrapped secret. Sharing with external email recipients required a one-time key exchange protocol built on top of this.",
      },
    ],
    hardParts:
      "The WebAuthn attestation ceremony has a dozen failure modes — counter monotonicity, RP ID hash validation, flags byte parsing, attestation statement format handling. Each has security implications if gotten wrong. The binary compilation required careful handling of native modules (bcrypt, crypto bindings) that don't survive standard pkg/nexe compilation without explicit asset bundling.",
    outcome:
      "Shipped: phishing-resistant passkey provider in production, E2EE sharing live for external recipients, self-contained binary deployed to enterprise clients in regulated industries.",
    published: false,
    sortOrder: 1,
  },
  {
    slug: "vanaways-crm-modular-monolith",
    title: "Vanaways CRM — Modular Monolith with Azure Service Bus",
    context:
      "A UK mini-truck sales business needed a full sales platform: dealers uploading stock, customers comparing quotations (Hire Purchase, balloon payments, leasing), and a complete document-signing journey. Three separate portals needed to share data reliably without tight coupling.",
    problem:
      "Three portals (Quotation, Dealer, Customer) with different ownership, different data needs, and different update cadences. They needed to share state reliably without a synchronous coupling that would make one portal's outage cascade to others.",
    architectureDiagram: "",
    keyDecisions: [
      {
        title: "Azure Service Bus over direct API calls between portals",
        chosen: "Azure Service Bus queues",
        alternative: "Direct HTTP calls between portal services",
        rationale:
          "Decouples portal lifecycle — a dealer portal deploy doesn't affect customer portal availability. Events (quotation accepted, document signed) are guaranteed-delivery with dead-letter queues for failure inspection.",
      },
      {
        title: "Modular monolith over microservices",
        chosen: "NestJS modular monolith",
        alternative: "Separate microservices per portal",
        rationale:
          "Team size and deployment complexity didn't justify full microservices overhead. Modular monolith gives clean boundaries with shared deployment — faster iteration, simpler debugging.",
      },
    ],
    hardParts:
      "The dynamic quotation engine — calculating Hire Purchase, balloon payments, and leasing options across variable deposit percentages, terms, and residual values — required a configurable rules engine rather than hardcoded formulas. The document signing flow needed to coordinate state across three portals atomically.",
    outcome:
      "All three portals shipped. Full end-to-end sales journey including document signing in production for UK automotive market.",
    published: false,
    sortOrder: 2,
  },
];

for (const cs of CASE_STUDIES) {
  await req("POST", "/content/case-studies", cs, TOKEN);
  process.stdout.write(".");
}
console.log(`\n✓ ${CASE_STUDIES.length} case study shells seeded\n`);

// ── 6. Site content ───────────────────────────────────────────────────────────
console.log("🎨 Seeding site content...");

await req(
  "PUT",
  "/content/site/hero",
  {
    value: {
      headline: "Hammad Afzal",
      subheadline:
        "I solve hard problems in real-time systems and applied AI. Voice agents that work, knowledge bases that learn, architectures that don't collapse under load.",
      ctaPrimary: "View Work",
      ctaSecondary: "Case Studies",
    },
  },
  TOKEN,
);
console.log("✓ Hero content");

await req(
  "PUT",
  "/content/site/about",
  {
    value: {
      narrative:
        "I solve hard problems in real-time systems and applied AI. Voice agents that work, knowledge bases that learn, architectures that don't collapse under load. I obsess over the constraints — latency, reliability, cost — because that's where the real engineering lives.",
    },
  },
  TOKEN,
);
console.log("✓ About content");

console.log("\n✅ All content seeded successfully!");
console.log(
  "   → Publish case studies at localhost:3002/dashboard/case-studies once you've reviewed and expanded them.",
);
console.log("   → Skills, Experience, Projects are live immediately.");
