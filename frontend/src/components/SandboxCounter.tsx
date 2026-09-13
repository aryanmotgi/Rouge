import { useEffect, useRef, useState } from 'react';
import { LIVE_REASONING_AGENT_COUNT } from '../mock/roster';
import './SandboxCounter.css';

const SANDBOX_TARGET = 100;

interface SandboxCounterProps {
  active: boolean;
}

/**
 * Purely cosmetic "sandboxes spinning up" odometer — NOT derived from the
 * event stream or tied to any real process. It exists to sell the scale of
 * the demo on stage. The live-reasoning badge next to it is the one number
 * that's real, and is visually distinct on purpose: never let the two blend
 * together, since real model calls cost time/money and only a handful of
 * agents are actually reasoning live.
 *
 * Ramps up only once a run is activated, and holds still once settled — no
 * idle jitter — so the dashboard reads as genuinely idle before activation
 * and calm (not decoratively "alive") once a run is underway.
 */
export function SandboxCounter({ active }: SandboxCounterProps) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setCount(0);
      return;
    }

    const start = performance.now();
    const rampMs = 1800;

    function tick(now: number) {
      const elapsed = now - start;
      if (elapsed < rampMs) {
        const progress = elapsed / rampMs;
        // ease-out ramp up to the target
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * SANDBOX_TARGET));
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCount(SANDBOX_TARGET);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  return (
    <div className="counter-row">
      <div className="counter-tile sandbox-tile">
        <span className="counter-value">~{count}</span>
        <span className="counter-label">sandboxes spinning up</span>
      </div>
      <div className="counter-tile live-tile">
        <span className="counter-value">{LIVE_REASONING_AGENT_COUNT}</span>
        <span className="counter-label">agents reasoning live</span>
      </div>
    </div>
  );
}
