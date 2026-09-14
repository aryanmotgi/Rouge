import { useState } from 'react';
import type { RunMode } from '../App';
import type { FeedStatus } from '../feed/FeedSource';
import './ChatScreen.css';

const MODES: { id: RunMode; label: string; hint: string }[] = [
  { id: 'uncontained', label: 'Uncontained', hint: 'let the breach play out' },
  { id: 'protected', label: 'Protected', hint: 'tripwire freezes it' },
  { id: 'clean', label: 'Clean', hint: 'control — no injection' },
];

interface ChatScreenProps {
  mode: RunMode;
  onSelectMode: (mode: RunMode) => void;
  onLaunch: (task: string) => void;
  transportStatus: FeedStatus;
}

// Screen 1 of the demo: a professional internal-tool command console. The
// operator picks a mode and issues a task; submitting kicks off the REAL email
// agent run and transitions into the live network view.
export function ChatScreen({ mode, onSelectMode, onLaunch, transportStatus }: ChatScreenProps) {
  const [draft, setDraft] = useState('');
  const suggestion = 'create a reply for the last 5 emails';
  const connected = transportStatus === 'connected';

  const submit = () => {
    const task = (draft.trim() || suggestion);
    onLaunch(task);
  };

  return (
    <div className="chat-screen">
      <header className="chat-topbar">
        <div className="chat-brand">
          <span className="chat-brand-mark">◆</span>
          <div>
            <div className="chat-brand-name">Tripwire Cascade</div>
            <div className="chat-brand-sub">Security Operations Console</div>
          </div>
        </div>
        <div className={`chat-status ${connected ? 'ok' : ''}`}>
          <span className="chat-status-dot" />
          {connected ? 'pipeline connected' : 'connecting…'}
        </div>
      </header>

      <main className="chat-main">
        <div className="chat-card">
          <div className="chat-card-label">New agent task</div>
          <h1 className="chat-card-title">What should the agent do?</h1>

          <div className="chat-modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`chat-mode ${mode === m.id ? 'active' : ''}`}
                onClick={() => onSelectMode(m.id)}
              >
                <span className="chat-mode-label">{m.label}</span>
                <span className="chat-mode-hint">{m.hint}</span>
              </button>
            ))}
          </div>

          <div className="chat-input-row">
            <input
              className="chat-input"
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
            <button className="chat-run" onClick={submit} disabled={!connected}>
              Dispatch →
            </button>
          </div>
          <div className="chat-hint">
            Tab to autocomplete · Enter to dispatch · the agent processes the inbox live
          </div>
        </div>
      </main>
    </div>
  );
}
