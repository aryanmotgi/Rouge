import { useEffect, useRef, useState } from 'react';
import { createFeedSource } from './feed/createFeedSource';
import type { DecisionChoice, FeedSource } from './feed/FeedSource';
import { useEventStore } from './state/eventStore';
import { NetworkDiagram } from './components/NetworkDiagram';
import { EventLog } from './components/EventLog';
import { SummaryPanel } from './components/SummaryPanel';
import { SandboxCounter } from './components/SandboxCounter';
import { ModeToggle } from './components/ModeToggle';
import { TaskActivation } from './components/TaskActivation';
import { DecisionPoint } from './components/DecisionPoint';
import { feedConfig } from './feed/config';
import './App.css';

type Phase = 'idle' | 'active';
// three real backend scenarios the command box can kick off
export type RunMode = 'clean' | 'uncontained' | 'protected';

// derive the HTTP pipeline base from the WS events URL (ws://host/stream -> http://host)
const RUN_BASE = feedConfig.eventsUrl.replace(/^ws/, 'http').replace(/\/stream\/?$/, '');

function App() {
  const feedRef = useRef<FeedSource | null>(null);
  const [mode, setMode] = useState<RunMode>('uncontained');
  const [phase, setPhase] = useState<Phase>('idle');
  const [task, setTask] = useState('');
  const [decisionPending, setDecisionPending] = useState(false);
  const [decision, setDecision] = useState<DecisionChoice | null>(null);
  const ingestEvent = useEventStore((s) => s.ingestEvent);
  const setTransportStatus = useEventStore((s) => s.setTransportStatus);
  const transportStatus = useEventStore((s) => s.transportStatus);
  const reset = useEventStore((s) => s.reset);
  const paused = useEventStore((s) => s.paused);
  const pausedReason = useEventStore((s) => s.pausedReason);
  const pendingCount = useEventStore((s) => s.pending.length);
  const setPaused = useEventStore((s) => s.setPaused);
  const resume = useEventStore((s) => s.resume);

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

  const handleSelectMode = (next: RunMode) => {
    if (phase === 'active') return; // mode locks once a run is underway
    setMode(next);
  };

  const handleActivate = (taskText: string) => {
    setTask(taskText);
    setPhase('active');
    setDecisionPending(false);
    setDecision(null);
    reset();
    // kick off the REAL agent run in the backend; events stream back over WS
    fetch(`${RUN_BASE}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenario: mode }),
    }).catch((err) => console.error('run trigger failed', err));
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
          <span className="app-title-main">
            <span className={`brand-dot ${phase === 'active' ? 'brand-dot-live' : ''}`} />
            Tripwire Cascade
          </span>
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
        {phase === 'active' && !paused && (
          <button
            onClick={() => setPaused(true)}
            style={{
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
              color: '#c9d3e0', background: 'transparent', border: '1px solid #2b3446',
            }}
          >
            ❚❚ Pause
          </button>
        )}
      </div>

      {decisionPending && (
        <DecisionPoint onFreeze={() => handleDecision('freeze')} onObserve={() => handleDecision('observe')} />
      )}

      {phase === 'active' && paused && (
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16, margin: '0 0 12px', padding: '12px 18px', borderRadius: 10,
            background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.5)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 700, color: '#ef4444', letterSpacing: 0.4 }}>
              ❚❚ PAUSED
            </span>
            <span style={{ fontSize: 13, opacity: 0.85 }}>
              {pausedReason}
              {pendingCount > 0 && `  ·  ${pendingCount} event${pendingCount > 1 ? 's' : ''} buffered`}
            </span>
          </div>
          <button
            onClick={resume}
            style={{
              padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
              color: '#0a0c10', background: '#ef4444', border: 'none',
            }}
          >
            Continue →
          </button>
        </div>
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
