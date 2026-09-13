export type FeedTransport = 'mock' | 'sse' | 'websocket';

export interface FeedConfig {
  transport: FeedTransport;
  eventsUrl: string;
  initialScenario: 'clean' | 'uncontained';
}

// Wired to the REAL pipeline (Aryan's server): WebSocket at /stream on :8787,
// which replays history on connect then streams live events. Override per-machine
// in .env.local (e.g. VITE_EVENTS_URL=ws://<aryan-lan-ip>:8787/stream when the
// dashboard runs on a different laptop than the pipeline). Set transport=mock to
// fall back to canned scenarios for offline UI work.
export const feedConfig: FeedConfig = {
  transport: (import.meta.env.VITE_FEED_TRANSPORT as FeedTransport) || 'websocket',
  eventsUrl: import.meta.env.VITE_EVENTS_URL || 'ws://localhost:8787/stream',
  initialScenario: 'clean',
};
