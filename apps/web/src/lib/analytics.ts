const API_URL = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') : '';

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let sid = sessionStorage.getItem('_sid');
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('_sid', sid); }
  return sid;
}

export function trackEvent(type: string, metadata: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || !API_URL) return;
  if (navigator.doNotTrack === '1') return;
  fetch(API_URL + '/analytics/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, path: window.location.pathname, sessionId: getSessionId(), metadata }),
    keepalive: true,
  }).catch(() => {});
}

export const trackPageView = () => trackEvent('page_view');
export const trackConversion = (type: string, meta?: Record<string, unknown>) => trackEvent(type, meta ?? {});
export const trackSectionView = (section: string) => trackEvent('section_view', { section });
export const trackCaseStudyRead = (slug: string) => trackEvent('case_study_read', { slug });
