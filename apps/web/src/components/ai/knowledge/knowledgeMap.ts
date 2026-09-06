// knowledgeMap.ts — Static knowledge graph for the RAG chatbot.
// Each node describes a portfolio section with topics and a plain-text summary.
// Used to route chatbot queries to the right section before hitting the vector store.

export interface KnowledgeNode {
  /** Portfolio section id — matches DOM id and NavigationEngine registry */
  section: string;
  /** Search terms / NLP topics this node covers */
  topics: string[];
  /** Human-readable summary the chatbot can cite directly */
  summary: string;
}

// ---------------------------------------------------------------------------
// Knowledge map
// ---------------------------------------------------------------------------

export const KNOWLEDGE_MAP: KnowledgeNode[] = [
  {
    section: "experience",
    topics: [
      "work experience",
      "career history",
      "employment",
      "job",
      "roles",
      "years of experience",
      "professional background",
      "companies",
      "taptap technologies",
      "backend developer",
      "senior engineer",
      "team lead",
      "achievements",
      "responsibilities",
    ],
    summary:
      "Hammad Afzal has several years of professional experience as a backend and full-stack engineer. " +
      "He has worked on production systems handling significant scale, led engineering teams, " +
      "and contributed to architecture decisions across multiple organisations including Taptap Technologies. " +
      "His roles have spanned API design, microservices, cloud infrastructure, and engineering leadership.",
  },
  {
    section: "skills",
    topics: [
      "skills",
      "technologies",
      "tech stack",
      "programming languages",
      "frameworks",
      "tools",
      "databases",
      "nestjs",
      "nextjs",
      "react",
      "typescript",
      "node.js",
      "postgresql",
      "pgvector",
      "redis",
      "docker",
      "prisma",
      "tailwind",
      "react three fiber",
      "three.js",
      "graphql",
      "rest api",
      "ci/cd",
      "github actions",
      "turborepo",
      "pnpm",
      "linux",
      "nginx",
      "caddy",
      "deepseek",
      "llm",
      "ai",
      "vector search",
      "websockets",
      "socket.io",
    ],
    summary:
      "Hammad's primary expertise is backend engineering with NestJS and TypeScript. " +
      "He is proficient in PostgreSQL (including pgvector for semantic search), Redis, Prisma ORM, " +
      "Docker, and CI/CD pipelines. On the frontend he works with Next.js (App Router), React, " +
      "Tailwind CSS, and react-three-fiber for 3D interfaces. " +
      "He has experience integrating LLM providers (DeepSeek, OpenAI) through clean adapter patterns " +
      "and building first-party analytics pipelines.",
  },
  {
    section: "projects",
    topics: [
      "projects",
      "portfolio work",
      "case studies",
      "built",
      "side projects",
      "open source",
      "applications",
      "saas",
      "crm",
      "sales crm",
      "platform",
      "api",
      "monorepo",
      "full stack project",
      "real-time",
      "rag",
      "chatbot",
      "analytics dashboard",
      "admin panel",
      "e-commerce",
    ],
    summary:
      "Hammad's project work demonstrates end-to-end product engineering. " +
      "Notable projects include a Sales CRM platform with real-time pipeline tracking, " +
      "a RAG-powered portfolio chatbot using pgvector and DeepSeek, " +
      "and this portfolio platform itself — a Turborepo monorepo with NestJS backend, " +
      "Next.js App Router frontend, 3D hero built in react-three-fiber, and a first-party analytics system. " +
      "Each project is built with clean architecture, strict TypeScript, and production-grade tooling.",
  },
  {
    section: "availability",
    topics: [
      "availability",
      "available for hire",
      "open to work",
      "hiring",
      "freelance",
      "contract",
      "full-time",
      "part-time",
      "remote",
      "on-site",
      "hybrid",
      "location",
      "uk",
      "pakistan",
      "notice period",
      "start date",
      "when available",
      "rates",
      "salary",
    ],
    summary:
      "Hammad is currently open to new opportunities including full-time roles, contract engagements, " +
      "and freelance projects. He works remotely and is based in the UK. " +
      "He is particularly interested in backend-heavy or full-stack roles where clean architecture " +
      "and technical leadership are valued. For specific availability dates or rates, " +
      "please reach out directly through the contact section.",
  },
];

// ---------------------------------------------------------------------------
// findRelevantSection — lightweight keyword scorer
// ---------------------------------------------------------------------------

/**
 * Returns the best-matching KnowledgeNode for a natural-language query,
 * or null if no node reaches the minimum confidence threshold.
 */
export function findRelevantSection(query: string): KnowledgeNode | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  const qWords = q.split(/\s+/);

  let bestNode: KnowledgeNode | null = null;
  let bestScore = 0;

  for (const node of KNOWLEDGE_MAP) {
    let score = 0;

    for (const topic of node.topics) {
      const topicLower = topic.toLowerCase();

      // Exact phrase match in query
      if (q.includes(topicLower)) {
        score += topicLower.split(/\s+/).length * 10; // longer phrase = higher weight
        continue;
      }

      // Word-level partial match
      const topicWords = topicLower.split(/\s+/);
      for (const qw of qWords) {
        for (const tw of topicWords) {
          if (qw === tw) score += 5;
          else if (tw.startsWith(qw) || qw.startsWith(tw)) score += 2;
        }
      }
    }

    // Also check section id directly
    if (q.includes(node.section)) score += 15;

    if (score > bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  // Minimum confidence: at least one meaningful match
  return bestScore >= 5 ? bestNode : null;
}
