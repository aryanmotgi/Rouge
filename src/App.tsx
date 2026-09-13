import { useEffect, useRef, useState } from 'react';
import { createFeedSource } from './feed/createFeedSource';
import type { FeedSource, ScenarioId } from './feed/FeedSource';
import { useEventStore } from './state/eventStore';
import { NetworkDiagram } from './components/NetworkDiagram';
import { EventLog } from './components/EventLog';
import { SummaryPanel } from './components/SummaryPanel';
import { SandboxCounter } from './components/SandboxCounter';
import { ModeToggle } from './components/ModeToggle';
import './App.css';

function App() {
  const feedRef = useRef<FeedSource | null>(null);
  const [mode, setMode] = useState<ScenarioId>('clean');
  const ingestEvent = useEventStore((s) => s.ingestEvent);
  const setTransportStatus = useEventStore((s) => s.setTransportStatus);
  const transportStatus = useEventStore((s) => s.transportStatus);
  const reset = useEventStore((s) => s.reset);

  useEffect(() => {
    const feed = createFeedSource();
    feedRef.current = feed;
    feed.connect({ onEvent: ingestEvent, onStatus: setTransportStatus });
    return () => feed.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectMode = (next: ScenarioId) => {
    setMode(next);
    reset();
    feedRef.current?.loadScenario?.(next);
  };

  const handleRestart = () => {
    reset();
    feedRef.current?.restart?.();
  };

  const controllable = feedRef.current?.capabilities.controllable ?? true;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="app-title-main">Tripwire Cascade</span>
          <span className="app-title-sub">live containment dashboard</span>
        </div>
        <SandboxCounter />
      </header>

      <div className="app-toolbar">
        <ModeToggle
          activeMode={mode}
          onSelect={handleSelectMode}
          onRestart={handleRestart}
          controllable={controllable}
          transportStatus={transportStatus}
        />
      </div>

      <main className="app-grid">
        <section className="panel panel-network">
          <NetworkDiagram />
        </section>
        <section className="panel panel-summary">
          <SummaryPanel />
        </section>
        <section className="panel panel-log">
          <EventLog />
        </section>
      </main>
    </div>
  );
}

export default App;
