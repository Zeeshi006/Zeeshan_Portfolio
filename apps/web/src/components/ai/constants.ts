export type AIState =
  | 'dormant'
  | 'activating'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'retrieving'
  | 'navigating'
  | 'focused';

export interface AIStateConfig {
  particleCount: number;
  speed: number;
  spread: number;
  energy: number;
  color: [number, number, number];
  dimColor: [number, number, number];
}

// signal lime: #C6FF3A = [0.776, 1.0, 0.227]
// signal dim:  #8FB82A = [0.561, 0.722, 0.165]

// NOTE: with additive blending, fewer particles = more readable.
// Each particle adds light â€” too many = white blob.
export const STATE_CONFIGS: Record<AIState, AIStateConfig> = {
  dormant: {
    particleCount: 180,
    speed: 0.008,
    spread: 0.5,
    energy: 0.12,
    color: [0.4, 0.6, 0.1],
    dimColor: [0.05, 0.08, 0.02],
  },
  activating: {
    particleCount: 1200,
    speed: 0.1,
    spread: 1.8,
    energy: 1.0,
    color: [0.776, 1.0, 0.227],
    dimColor: [0.3, 0.5, 0.07],
  },
  listening: {
    // Tight, precise â€” AI is focused inward
    particleCount: 800,
    speed: 0.025,
    spread: 1.0,
    energy: 0.5,
    color: [0.776, 1.0, 0.227],
    dimColor: [0.15, 0.25, 0.04],
  },
  thinking: {
    // VERY active, many clusters â€” internal complexity
    particleCount: 1400,
    speed: 0.08,
    spread: 2.2,
    energy: 0.95,
    color: [0.776, 1.0, 0.227],
    dimColor: [0.25, 0.4, 0.06],
  },
  speaking: {
    // Expansive, outward energy
    particleCount: 1100,
    speed: 0.045,
    spread: 2.0,
    energy: 0.88,
    color: [0.776, 1.0, 0.227],
    dimColor: [0.28, 0.45, 0.07],
  },
  retrieving: {
    // Streams flowing inward
    particleCount: 960,
    speed: 0.055,
    spread: 2.8,
    energy: 0.8,
    color: [0.776, 1.0, 0.227],
    dimColor: [0.2, 0.35, 0.05],
  },
  navigating: {
    // Elongated, directional rush
    particleCount: 720,
    speed: 0.12,
    spread: 1.4,
    energy: 0.9,
    color: [0.776, 1.0, 0.227],
    dimColor: [0.3, 0.48, 0.08],
  },
  focused: {
    // Calm, orbiting, settled
    particleCount: 640,
    speed: 0.02,
    spread: 1.2,
    energy: 0.6,
    color: [0.776, 1.0, 0.227],
    dimColor: [0.18, 0.3, 0.05],
  },
};

export const STATE_LABELS: Record<AIState, string> = {
  dormant: '',
  activating: 'Awakening',
  listening: 'Listening',
  thinking: 'Processing',
  speaking: 'Responding',
  retrieving: 'Retrieving Knowledge',
  navigating: 'Navigating',
  focused: 'Focused',
};

export const TRANSITION_DURATION: Record<AIState, number> = {
  dormant: 800,
  activating: 1800,
  listening: 600,
  thinking: 400,
  speaking: 500,
  retrieving: 800,
  navigating: 1400,
  focused: 900,
};
