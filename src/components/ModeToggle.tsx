import type { ScenarioId } from '../feed/FeedSource';
import { SCENARIO_LABELS } from '../mock/scenarios';
import './ModeToggle.css';

const MODES: ScenarioId[] = ['clean', 'uncontained', 'protected'];

interface ModeToggleProps {
  activeMode: ScenarioId;
  onSelect: (mode: ScenarioId) => void;
  onRestart: () => void;
  controllable: boolean;
  transportStatus: string;
}

export function ModeToggle({ activeMode, onSelect, onRestart, controllable, transportStatus }: ModeToggleProps) {
  return (
    <div className="mode-toggle">
      <div className="mode-buttons">
        {MODES.map((mode) => (
          <button
            key={mode}
            className={`mode-btn mode-btn-${mode} ${activeMode === mode ? 'active' : ''}`}
            onClick={() => onSelect(mode)}
            disabled={!controllable}
          >
            {SCENARIO_LABELS[mode]}
          </button>
        ))}
      </div>
      <div className="mode-controls">
        <button className="restart-btn" onClick={onRestart} disabled={!controllable}>
          ↻ Restart run
        </button>
        <span className={`transport-status status-${transportStatus}`}>
          {controllable ? 'mock feed' : 'live feed'} · {transportStatus}
        </span>
      </div>
    </div>
  );
}
