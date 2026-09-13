import type { TripwireEvent } from '../types/events';
import { SCENARIOS } from '../mock/scenarios';
import type { FeedHandlers, FeedSource, ScenarioId } from './FeedSource';

/**
 * Plays a scripted scenario against wall-clock delays so it behaves like a
 * real stream (events trickle in, timestamps are stamped at emit time).
 * Fully restartable so you can rehearse a mode over and over without
 * reloading the page.
 */
export class MockFeedSource implements FeedSource {
  readonly capabilities = { controllable: true };

  private handlers: FeedHandlers | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private scenarioId: ScenarioId;

  constructor(initialScenario: ScenarioId = 'clean') {
    this.scenarioId = initialScenario;
  }

  connect(handlers: FeedHandlers): void {
    this.handlers = handlers;
    handlers.onStatus?.('connected');
    this.play();
  }

  disconnect(): void {
    this.clearTimers();
    this.handlers?.onStatus?.('disconnected');
    this.handlers = null;
  }

  loadScenario(id: ScenarioId): void {
    this.scenarioId = id;
    this.restart();
  }

  restart(): void {
    this.clearTimers();
    if (this.handlers) this.play();
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private play() {
    const steps = SCENARIOS[this.scenarioId];
    let elapsed = 0;
    for (const step of steps) {
      elapsed += step.delayMs;
      const timer = setTimeout(() => {
        const { delayMs: _delayMs, ...eventFields } = step;
        const event: TripwireEvent = { ...eventFields, time: new Date().toISOString() };
        this.handlers?.onEvent(event);
      }, elapsed);
      this.timers.push(timer);
    }
  }
}
