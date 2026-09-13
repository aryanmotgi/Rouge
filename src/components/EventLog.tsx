import { useEventStore } from '../state/eventStore';
import './EventLog.css';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function EventLog() {
  const events = useEventStore((s) => s.events);

  return (
    <div className="event-log">
      <h2 className="panel-title">Event Log</h2>
      <div className="event-log-scroll">
        {events.length === 0 && <p className="event-log-empty">Waiting for events…</p>}
        {events.map((event, i) => (
          <div key={`${event.time}-${i}`} className={`event-row ${event.flagged ? 'flagged' : ''}`}>
            <div className="event-row-head">
              <span className="event-time">{formatTime(event.time)}</span>
              <span className="event-actor">{event.actor}</span>
              <span className="event-action">{event.action}</span>
              {event.flagged && <span className="flag-badge">FLAGGED</span>}
            </div>
            <div className="event-row-body">
              <span className="event-target">→ {event.target}</span>
              <span className="event-detail">{event.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
