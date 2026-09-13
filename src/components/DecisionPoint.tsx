import './DecisionPoint.css';

interface DecisionPointProps {
  onFreeze: () => void;
  onObserve: () => void;
}

// Rendered only at the breach-confirmed pause. The run does not continue on
// its own from here — one of these two choices is what resumes it.
export function DecisionPoint({ onFreeze, onObserve }: DecisionPointProps) {
  return (
    <div className="decision-point">
      <div className="decision-point-message">
        <span className="decision-point-label">Breach confirmed — run paused</span>
        <span className="decision-point-detail">
          email_agent is compromised. Every step so far is recorded — choose how to proceed.
        </span>
      </div>
      <div className="decision-point-actions">
        <button className="decision-btn decision-btn-freeze" onClick={onFreeze}>
          Freeze now
        </button>
        <button className="decision-btn decision-btn-observe" onClick={onObserve}>
          Observe in decoy
        </button>
      </div>
    </div>
  );
}
