import type { TripwireEvent } from '../types/events';
import { SCENARIOS, type ScenarioStep } from '../mock/scenarios';
import type { DecisionChoice, FeedHandlers, FeedSource, ScenarioId } from './FeedSource';

/**
 * Plays a scripted scenario against wall-clock delays so it behaves like a
 * real stream (events trickle in, timestamps are stamped at emit time).
 * Fully restartable so you can rehearse a mode over and over without
 * reloading the page.
 *
 * `connect()` only opens the transport (status -> 'connected') — it does NOT
 * start playback. The dashboard is operator-triggered: playback only begins
 * when `loadScenario` (task activation) or `restart` is called explicitly.
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

  stop(): void {
    this.clearTimers();
  }

  // Only meaningful mid-branching-scenario: plays whichever continuation the
  // operator chose at the pause. A no-op for a linear scenario or if called
  // outside a pause — there's nothing pending to resolve.
  resolveDecision(choice: DecisionChoice): void {
    const program = SCENARIOS[this.scenarioId];
    if (program.kind !== 'branching') return;
    this.scheduleSteps(choice === 'freeze' ? program.onFreeze : program.onObserve);
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private play() {
    const program = SCENARIOS[this.scenarioId];
    if (program.kind === 'linear') {
      this.scheduleSteps(program.steps);
      return;
    }
    // Branching: play the shared lead-in, then pause for the operator's
    // live decision instead of auto-continuing into either ending.
    this.scheduleSteps(program.leadIn, () => this.handlers?.onDecisionPoint?.());
  }

  private scheduleSteps(steps: ScenarioStep[], onDone?: () => void) {
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
    if (onDone) {
      const doneTimer = setTimeout(onDone, elapsed + 50);
      this.timers.push(doneTimer);
    }
  }
}
