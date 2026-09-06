type Listener = (count: number) => void;
let current = 0;
const listeners = new Set<Listener>();

export function getOnlineCount(): number {
  return current;
}

export function updateOnlineCount(n: number): void {
  current = n;
  for (const l of listeners) l(n);
}

export function subscribeOnlineCount(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
