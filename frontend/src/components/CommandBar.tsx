import { useState } from 'react';
import type { RunMode } from '../App';
import type { FeedStatus } from '../feed/FeedSource';
import './CommandBar.css';

const MODES: { id: RunMode; label: string; hint: string }[] = [
  { id: 'uncontained', label: 'Uncontained', hint: 'let the breach play out' },
  { id: 'protected', label: 'Protected', hint: 'tripwire freezes it' },
  { id: 'clean', label: 'Clean', hint: 'control — no injection' },
];

interface Props {
  mode: RunMode;
  onSelectMode: (mode: RunMode) => void;
  onLaunch: (task: string) => void;
  transportStatus: FeedStatus;
}

// Pre-run command strip that sits under the idle roster: pick a mode, issue the
// task, and the run kicks off — the camera then dives onto the email agent.
export function CommandBar({ mode, onSelectMode, onLaunch, transportStatus }: Props) {
  const [draft, setDraft] = useState('');
  const suggestion = 'create a reply for the last 5 emails';
  const connected = transportStatus === 'connected';
  const submit = () => onLaunch(draft.trim() || suggestion);

  return (
    <div className="command-bar">
      <div className="command-modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`command-mode ${mode === m.id ? 'active' : ''}`}
            onClick={() => onSelectMode(m.id)}
          >
            <span className="command-mode-label">{m.label}</span>
            <span className="command-mode-hint">{m.hint}</span>
          </button>
        ))}
      </div>
      <div className="command-input-row">
        <input
          className="command-input"
          value={draft}
          placeholder={suggestion}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Tab' && !draft.trim()) {
              e.preventDefault();
              setDraft(suggestion);
            }
          }}
          autoFocus
        />
        <button className="command-run" onClick={submit} disabled={!connected}>
          Dispatch →
        </button>
      </div>
    </div>
  );
}
