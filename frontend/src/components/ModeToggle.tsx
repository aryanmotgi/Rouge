import type { RunMode } from '../App';
import './ModeToggle.css';

const MODES: RunMode[] = ['clean', 'uncontained', 'protected'];
const MODE_LABELS: Record<RunMode, string> = {
  clean: 'Clean',
  uncontained: 'Uncontained',
  protected: 'Protected',
};

interface ModeToggleProps {
  activeMode: RunMode;
  onSelect: (mode: RunMode) => void;
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
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}
