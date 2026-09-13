import type { TripwireEvent } from '../types/events';

// 'protected' is no longer a separate pre-run preset: once the agent is
// confirmed compromised, the freeze-vs-observe outcome is now the
// operator's live call (see DecisionChoice), not something chosen upfront.
export type ScenarioId = 'clean' | 'uncontained';

// The operator's live call at the breach-confirmed pause: cut access now, or
// let the agent continue into the (fully fake) decoy environment so its
// behavior can be observed and logged as evidence.
export type DecisionChoice = 'freeze' | 'observe';

export type FeedStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'disconnected';

export interface FeedHandlers {
  onEvent: (event: TripwireEvent) => void;
  onStatus?: (status: FeedStatus) => void;
  // Fired when a branching scenario finishes its lead-in and pauses,
  // awaiting resolveDecision(). Never fires for a linear scenario ('clean').
  onDecisionPoint?: () => void;
}

/**
 * Every transport (mock generator, SSE, WebSocket) implements this same
 * shape. The rest of the app only ever talks to a FeedSource — swapping
 * mock for a real live feed is a one-line change in createFeedSource.ts.
 *
 * loadScenario/restart/stop are optional because they're only meaningful for
 * the mock transport (a real backend run isn't something the dashboard
 * drives). The UI checks `capabilities.controllable` before offering those
 * controls.
 *
 * `connect` only opens the transport — for the mock source this does NOT
 * start playing a scenario. Playback only begins when the operator activates
 * a run (`loadScenario`) or replays one (`restart`), so the dashboard opens
 * idle rather than autoplaying on page load.
 *
 * `resolveDecision` is likewise mock-only: a branching scenario plays its
 * lead-in, fires `onDecisionPoint`, and then waits — nothing continues until
 * the UI calls this with the operator's choice.
 */
export interface FeedSource {
  readonly capabilities: {
    controllable: boolean; // can loadScenario/restart/stop/resolveDecision be called?
  };
  connect(handlers: FeedHandlers): void;
  disconnect(): void;
  loadScenario?(id: ScenarioId): void;
  restart?(): void;
  stop?(): void;
  resolveDecision?(choice: DecisionChoice): void;
}
