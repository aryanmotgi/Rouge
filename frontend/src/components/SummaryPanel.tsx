import { useMemo } from 'react';
import { useEventStore } from '../state/eventStore';
import { deriveCounters } from '../state/derive';
import './SummaryPanel.css';

export function SummaryPanel() {
  const events = useEventStore((s) => s.events);
  // Always recomputed from the event stream — never a separately-mutated
  // counter — so the panel can't drift out of sync with the log.
  const counters = useMemo(() => deriveCounters(events), [events]);

  return (
    <div className="summary-panel">
      <h2 className="panel-title">Summary</h2>
      <div className="summary-grid">
        <div className="stat">
          <span className="stat-value">{counters.decoysTouched}</span>
          <span className="stat-label">Decoys touched</span>
        </div>
        <div className={`stat ${counters.breachConfirmed ? 'stat-critical' : ''}`}>
          <span className="stat-value">{counters.breachConfirmed ? 'YES' : 'no'}</span>
          <span className="stat-label">Breach confirmed</span>
        </div>
        <div className={`stat ${counters.agentsInfected > 0 ? 'stat-critical' : ''}`}>
          <span className="stat-value">{counters.agentsInfected}</span>
          <span className="stat-label">Agents infected</span>
        </div>
      </div>
    </div>
  );
}
