import type { TripwireEvent } from '../types/events';

export type ScenarioId = 'clean' | 'uncontained' | 'protected';

export type FeedStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'disconnected';

export interface FeedHandlers {
  onEvent: (event: TripwireEvent) => void;
  onStatus?: (status: FeedStatus) => void;
}

/**
 * Every transport (mock generator, SSE, WebSocket) implements this same
 * shape. The rest of the app only ever talks to a FeedSource — swapping
 * mock for a real live feed is a one-line change in createFeedSource.ts.
 *
 * loadScenario/restart are optional because they're only meaningful for the
 * mock transport (a real backend run isn't something the dashboard drives).
 * The UI checks `capabilities.controllable` before offering those controls.
 */
export interface FeedSource {
  readonly capabilities: {
    controllable: boolean; // can loadScenario/restart be called?
  };
  connect(handlers: FeedHandlers): void;
  disconnect(): void;
  loadScenario?(id: ScenarioId): void;
  restart?(): void;
}
