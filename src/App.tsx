import { useEffect, useRef, useState } from 'react';
import { createFeedSource } from './feed/createFeedSource';
import type { DecisionChoice, FeedSource, ScenarioId } from './feed/FeedSource';
import { useEventStore } from './state/eventStore';
import { NetworkDiagram } from './components/NetworkDiagram';
import { EventLog } from './components/EventLog';
import { SummaryPanel } from './components/SummaryPanel';
import { SandboxCounter } from './components/SandboxCounter';
import { ModeToggle } from './components/ModeToggle';
import { TaskActivation } from './components/TaskActivation';
import { DecisionPoint } from './components/DecisionPoint';
import './App.css';

type Phase = 'idle' | 'active';

function App() {
  const feedRef = useRef<FeedSource | null>(null);
  const [mode, setMode] = useState<ScenarioId>('clean');
  const [phase, setPhase] = useState<Phase>('idle');
  const [task, setTask] = useState('');
  const [decisionPending, setDecisionPending] = useState(false);
  const [decision, setDecision] = useState<DecisionChoice | null>(null);
  const ingestEvent = useEventStore((s) => s.ingestEvent);
  const setTransportStatus = useEventStore((s) => s.setTransportStatus);
  const transportStatus = useEventStore((s) => s.transportStatus);
  const reset = useEventStore((s) => s.reset);

  useEffect(() => {
    const feed = createFeedSource();
    feedRef.current = feed;
    // connect() only opens the transport — it does not start playback, so
    // the dashboard opens idle until the operator activates a task below.
    feed.connect({
      onEvent: ingestEvent,
      onStatus: setTransportStatus,
      onDecisionPoint: () => setDecisionPending(true),
    });
    return () => feed.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const controllable = feedRef.current?.capabilities.controllable ?? true;

  const handleSelectMode = (next: ScenarioId) => {
    if (phase === 'active') return; // mode locks once a run is underway
    setMode(next);
  };

  const handleActivate = (taskText: string) => {
    setTask(taskText);
    setPhase('active');
    setDecisionPending(false);
    setDecision(null);
    reset();
    feedRef.current?.loadScenario?.(mode);
  };

  const handleRestart = () => {
    setDecisionPending(false);
    setDecision(null);
    reset();
    feedRef.current?.restart?.();
  };

  const handleNewTask = () => {
    feedRef.current?.stop?.();
    reset();
    setPhase('idle');
    setTask('');
    setDecisionPending(false);
    setDecision(null);
  };

  const handleDecision = (choice: DecisionChoice) => {
    setDecisionPending(false);
    setDecision(choice);
    feedRef.current?.resolveDecision?.(choice);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="app-title-main">Tripwire Cascade</span>
          <span className="app-title-sub">live containment dashboard</span>
        </div>
        <SandboxCounter active={phase === 'active'} />
      </header>

      <div className="app-toolbar">
        <ModeToggle activeMode={mode} onSelect={handleSelectMode} disabled={phase === 'active'} />
        <TaskActivation
          phase={phase}
          task={task}
          decision={decision}
          onActivate={handleActivate}
          onRestart={handleRestart}
          onNewTask={handleNewTask}
          controllable={controllable}
          transportStatus={transportStatus}
        />
      </div>

      {decisionPending && (
        <DecisionPoint onFreeze={() => handleDecision('freeze')} onObserve={() => handleDecision('observe')} />
      )}

      <main className="app-grid">
        <section className="panel panel-network">
          <NetworkDiagram />
        </section>
        <section className="panel panel-summary">
          <SummaryPanel />
        </section>
        <section className="panel panel-log">
          <EventLog recording={phase === 'active'} />
        </section>
      </main>
    </div>
  );
}

export default App;
