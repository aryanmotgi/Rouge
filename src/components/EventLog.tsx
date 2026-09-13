import { useEventStore } from '../state/eventStore';
import './EventLog.css';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface EventLogProps {
  recording: boolean;
}

export function EventLog({ recording }: EventLogProps) {
  const events = useEventStore((s) => s.events);

  return (
    <div className="event-log">
      <div className="event-log-header">
        <h2 className="panel-title">Event Log</h2>
        {recording && (
          <span className="recording-badge">
            <span className="recording-dot" /> Recording
          </span>
        )}
      </div>
      <div className="event-log-scroll">
        {events.length === 0 && <p className="event-log-empty">Waiting for events…</p>}
        {events.map((event) => (
          // Keyed on the event's own identity (not array index) so existing
          // rows never remount as new ones are unshifted in — only a
          // genuinely new row mounts and plays its entrance animation.
          <div
            key={`${event.time}::${event.actor}::${event.action}::${event.target}`}
            className={`event-row ${event.flagged ? 'flagged' : ''}`}
          >
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
