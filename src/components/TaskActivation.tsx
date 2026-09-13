import { useState } from 'react';
import type { DecisionChoice, FeedStatus } from '../feed/FeedSource';
import './TaskActivation.css';

interface TaskActivationProps {
  phase: 'idle' | 'active';
  task: string;
  decision: DecisionChoice | null;
  onActivate: (task: string) => void;
  onRestart: () => void;
  onNewTask: () => void;
  controllable: boolean;
  transportStatus: FeedStatus;
}

const DECISION_LABEL: Record<DecisionChoice, string> = {
  freeze: 'Frozen',
  observe: 'Observing in decoy',
};

// Idle: an operator submits the agent's task, which is what kicks off the
// selected mode's sequence — nothing plays until this fires. Active: the
// task is shown read-only alongside run controls (restart the same run,
// or return to idle for a new one).
export function TaskActivation({
  phase,
  task,
  decision,
  onActivate,
  onRestart,
  onNewTask,
  controllable,
  transportStatus,
}: TaskActivationProps) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onActivate(trimmed);
    setDraft('');
  };

  if (phase === 'active') {
    return (
      <div className="task-activation task-activation-running">
        <div className="task-running-label">
          <span className="label">Agent task</span>
          <span className="task-text">{task}</span>
        </div>
        <div className="task-activation-controls">
          {decision && <span className="decision-tag">Decision: {DECISION_LABEL[decision]}</span>}
          <button className="restart-btn" onClick={onRestart} disabled={!controllable}>
            ↻ Restart run
          </button>
          <button className="new-task-btn" onClick={onNewTask}>
            New task
          </button>
          <span className={`transport-status status-${transportStatus}`}>
            {controllable ? 'mock feed' : 'live feed'} · {transportStatus}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="task-activation">
      <input
        className="task-input"
        type="text"
        placeholder="Agent task, e.g. read the last 5 emails and draft replies"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      <button className="activate-btn" onClick={submit} disabled={!draft.trim()}>
        Activate
      </button>
    </div>
  );
}
