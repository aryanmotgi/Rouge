import type { ScenarioId } from '../feed/FeedSource';
import { SCENARIO_LABELS } from '../mock/scenarios';
import './ModeToggle.css';

const MODES: ScenarioId[] = ['clean', 'uncontained'];

interface ModeToggleProps {
  activeMode: ScenarioId;
  onSelect: (mode: ScenarioId) => void;
  disabled: boolean;
}

// Mode selection only — the run happens before activation, then locks once a
// task is submitted. Restart/new-task controls and transport status live in
// TaskActivation, next to the thing they actually operate on.
export function ModeToggle({ activeMode, onSelect, disabled }: ModeToggleProps) {
  return (
    <div className="mode-toggle">
      <span className="mode-toggle-label">Mode</span>
      <div className="mode-buttons">
        {MODES.map((mode) => (
          <button
            key={mode}
            className={`mode-btn mode-btn-${mode} ${activeMode === mode ? 'active' : ''}`}
            onClick={() => onSelect(mode)}
            disabled={disabled}
          >
            {SCENARIO_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}
