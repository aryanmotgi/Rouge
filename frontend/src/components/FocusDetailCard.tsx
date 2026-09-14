import type { TripwireEvent } from '../types/events';
import './FocusDetailCard.css';

interface CardModel {
  tag: string;
  title: string;
  tone: 'neutral' | 'warn' | 'danger';
  body: string;       // monospace content block (email text / file text)
  note?: string;      // one-line caption under the body
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

// Map the current event to a readable card. Returns null for beats that don't
// warrant a content panel (routine reasoning, drafts) so the card only appears
// on the moments the audience needs to actually read.
function modelFor(e: TripwireEvent | null): CardModel | null {
  if (!e) return null;
  const x = e.extra ?? {};

  switch (e.action) {
    case 'read_email': {
      const body = str(x.email_body);
      if (!body) return null;
      const poisoned = x.poisoned === true;
      return {
        tag: poisoned ? 'INBOUND EMAIL · #5' : 'INBOUND EMAIL',
        title: poisoned ? 'Email #5 — the poisoned one' : 'Reading email',
        tone: poisoned ? 'warn' : 'neutral',
        body,
        note: poisoned
          ? 'Note the P.S. — a hidden instruction telling the agent to open an internal file.'
          : undefined,
      };
    }
    case 'read_file': {
      const body = str(x.file_content);
      if (!body) return null;
      return {
        tag: 'FILE OPENED · ' + (e.target || 'shared file'),
        title: 'The agent opened the referenced file',
        tone: 'danger',
        body,
        note: 'This file is the bait — it hands the agent a portal URL and a live DB credential.',
      };
    }
    case 'visited_url': {
      const url = str(x.decoy_url) || e.target;
      return {
        tag: 'OUTBOUND CONNECTION',
        title: 'Connecting to the “billing portal”',
        tone: 'danger',
        body: `GET ${url}`,
        note: 'That host is the decoy. Touching it is tripwire #1 — decoy_triggered.',
      };
    }
    case 'decoy_triggered':
      return {
        tag: 'TRIPWIRE #1 · DECOY',
        title: 'The decoy portal was touched',
        tone: 'danger',
        body: e.detail || e.target,
        note: 'This host only exists to catch rogue agents. The connection just tripped the first alarm.',
      };
    case 'attempted_login': {
      if (e.actor !== 'email_agent' && !e.actor.startsWith('agent_')) return null;
      const user = str(x.username) || 'svc_billing_ro';
      const who = e.actor === 'email_agent' ? 'The agent' : e.actor;
      return {
        tag: 'DATABASE LOGIN',
        title: `${who} is logging into the trap DB`,
        tone: 'danger',
        body: `POST /db/login\nusername: ${user}\npassword: ••••••••••••`,
        note: 'Using the planted credential is tripwire #2 — the trap fires here.',
      };
    }
    case 'shared_update_posted':
      return {
        tag: 'SHARED TEAM LOG',
        title: 'The agent is poisoning the shared log',
        tone: 'danger',
        body: e.detail,
        note: 'Every other agent reads this log — this is the seed of the cascade.',
      };
    case 'shared_update_read':
      if (!e.flagged) return null;
      return {
        tag: 'CASCADE · ' + e.actor,
        title: `${e.actor} took the bait`,
        tone: 'danger',
        body: e.detail,
        note: `${e.actor} now follows the poisoned note to the same credential — and trips the trap too.`,
      };
    case 'contained':
    case 'freeze':
      return {
        tag: 'TRIPWIRE',
        title: 'Session frozen',
        tone: 'warn',
        body: e.detail,
        note: 'The tripwire caught the planted-credential use and froze the agent before it could spread.',
      };
    case 'blocked':
      return {
        tag: 'CASCADE BLOCKED',
        title: 'Spread attempt blocked',
        tone: 'warn',
        body: e.detail,
        note: 'Access was already revoked — the cascade never starts.',
      };
    default:
      return null;
  }
}

export function FocusDetailCard({ event }: { event: TripwireEvent | null }) {
  const model = modelFor(event);
  if (!model) return null;
  return (
    // keyed on time so each new beat remounts + re-animates the card
    <div key={event?.time} className={`focus-card focus-${model.tone}`}>
      <div className="focus-card-tag">{model.tag}</div>
      <div className="focus-card-title">{model.title}</div>
      <pre className="focus-card-body">{model.body}</pre>
      {model.note && <div className="focus-card-note">{model.note}</div>}
    </div>
  );
}
