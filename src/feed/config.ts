export type FeedTransport = 'mock' | 'sse' | 'websocket';

export interface FeedConfig {
  transport: FeedTransport;
  eventsUrl: string;
  initialScenario: 'clean' | 'uncontained' | 'protected';
}

// Transport is undecided (SSE vs WebSocket) until the backend track confirms
// their endpoint — that's exactly why this lives in one env-driven spot
// instead of scattered through the app. Flip VITE_FEED_TRANSPORT (and set
// VITE_EVENTS_URL) in .env.local when the real /events feed is live; no
// component code needs to change.
export const feedConfig: FeedConfig = {
  transport: (import.meta.env.VITE_FEED_TRANSPORT as FeedTransport) || 'mock',
  eventsUrl: import.meta.env.VITE_EVENTS_URL || 'http://localhost:8000/events',
  initialScenario: 'clean',
};
