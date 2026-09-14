import { useRef, useState } from 'react';
import { useEventStore } from '../state/eventStore';
import { NODE_LAYOUT, EDGE_LAYOUT } from './networkLayout';
import { KNOWN_ACTORS } from '../types/events';
import type { TripwireEvent } from '../types/events';
import type { NodeStatus } from '../state/derive';
import { FocusDetailCard } from './FocusDetailCard';
import './NetworkDiagram.css';

const NODE_RADIUS: Record<string, number> = {
  agent: 34,
  decoy: 30,
  db: 30,
  cascade: 22,
};

// canvas + camera constants
const VIEW_W = 1000;
const VIEW_H = 620;
const CENTER_X = VIEW_W / 2;
const CENTER_Y = VIEW_H / 2;
const FOLLOW_ZOOM = 2.05; // how tight the camera zooms onto the active node

function nodeCenter(id: string) {
  const node = NODE_LAYOUT.find((n) => n.id === id);
  return node ? { x: node.x, y: node.y } : { x: CENTER_X, y: CENTER_Y };
}

const isLayoutNode = (id: string) => NODE_LAYOUT.some((n) => n.id === id);

export function NetworkDiagram({ prerun = false }: { prerun?: boolean }) {
  const nodeStatus = useEventStore((s) => s.nodeStatus);
  const edgePulses = useEventStore((s) => s.edgePulses);
  const nodeActivity = useEventStore((s) => s.nodeActivity);
  const lastEventLive = useEventStore((s) => s.lastEvent);
  const events = useEventStore((s) => s.events);

  // "follow" = camera tracks the active node (default cinematic view).
  // "map" = zoomed out to the whole system (presenter's big-picture toggle).
  const [freeCam, setFreeCam] = useState(false);

  // Pre-run is driven by the app phase, NOT by event history — the pipeline may
  // still hold a previous run's events (WS replays them on connect), but before
  // the operator dispatches we always want a clean idle roster.
  const lastEvent = prerun ? null : lastEventLive;
  const idle = prerun;
  // once the cascade starts spreading, pull the camera back so the audience
  // sees all the agents light up at once — the whole point of the cascade beat.
  const cascadeActive = !prerun && events.some(
    (e) => e.action === 'shared_update_read' && e.flagged,
  );
  const wideShot = freeCam || idle || cascadeActive;

  // the camera follows the most recent event whose actor is a real node; other
  // events (system/shared_log/tripwire) don't move the camera — it holds on the
  // last actor so a run reads as one continuous shot, never a jump to nowhere.
  const focusRef = useRef<string>(KNOWN_ACTORS.emailAgent);
  if (lastEvent && isLayoutNode(lastEvent.actor)) focusRef.current = lastEvent.actor;
  const focusId = focusRef.current;

  const c = nodeCenter(focusId);
  const zoom = wideShot ? 1 : FOLLOW_ZOOM;
  const tx = wideShot ? 0 : CENTER_X - zoom * c.x;
  const ty = wideShot ? 0 : CENTER_Y - zoom * c.y;
  const camStyle: React.CSSProperties = {
    transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
    transition: 'transform var(--t-slow, 0.8s) var(--ease-standard)',
  };

  // in pre-run only the idle roster (cascade agents) exists; email_agent/decoy/
  // tenki_db spawn once the run touches them.
  const isPresent = (id: string, kind: string) =>
    kind === 'cascade' || (!prerun && nodeStatus[id] !== undefined);
  const presentById = (id: string) => {
    const n = NODE_LAYOUT.find((node) => node.id === id);
    return n ? isPresent(n.id, n.kind) : false;
  };

  return (
    <div className="network-diagram">
      <div className="network-head">
        <h2 className="panel-title">
          {idle ? 'Standby — agent roster in sandboxes'
            : freeCam ? 'Network — full system'
            : cascadeActive ? 'Cascade — the tip spreads to every agent'
            : 'Camera — following the agent'}
        </h2>
        {!idle && (
          <button className="cam-toggle" onClick={() => setFreeCam((v) => !v)}>
            {freeCam ? '◎ Follow action' : '⤢ Zoom out'}
          </button>
        )}
      </div>

      <div className="network-stage">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="network-svg" role="img" aria-label="Agent network diagram">
          <g className="camera" style={camStyle}>
            {EDGE_LAYOUT.filter((e) => presentById(e.from) && presentById(e.to)).map((edge) => {
              const from = nodeCenter(edge.from);
              const to = nodeCenter(edge.to);
              const pulse = edgePulses[edge.id];
              const status: NodeStatus = pulse?.status ?? 'idle';
              return (
                <line
                  key={`${edge.id}-${pulse?.nonce ?? 0}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={`edge edge-appear edge-${status} ${
                    edge.variant === 'dashed' ? 'edge-dashed' : ''
                  } ${pulse ? 'edge-pulsing' : ''}`}
                />
              );
            })}

            {NODE_LAYOUT.filter((node) => isPresent(node.id, node.kind)).map((node) => {
              const status: NodeStatus = prerun ? 'idle' : (nodeStatus[node.id] ?? 'idle');
              const activity = prerun ? undefined : nodeActivity[node.id];
              const focused = node.id === focusId && !wideShot;
              return (
                <g
                  key={node.id}
                  className={`node node-spawn node-${status} ${focused ? 'node-focused' : ''}`}
                  transform={`translate(${node.x},${node.y})`}
                >
                  <circle r={NODE_RADIUS[node.kind]} className="node-circle" />
                  <circle r={NODE_RADIUS[node.kind]} className="node-ring" />
                  <text className="node-label" y={NODE_RADIUS[node.kind] + 16}>
                    {node.label}
                  </text>
                  {(() => {
                    const thought = activity?.label;
                    const idleAgent = node.kind === 'cascade';
                    if (!thought && !idleAgent) return null;
                    return (
                      <foreignObject
                        x={-96}
                        y={NODE_RADIUS[node.kind] + 24}
                        width={192}
                        height={52}
                        style={{ overflow: 'visible' }}
                      >
                        {thought ? (
                          <div
                            key={activity?.nonce ?? 'idle'}
                            className={`thought-bubble bubble-${status}`}
                          >
                            {thought}
                          </div>
                        ) : (
                          // idle roster agent: honest role + its Wasmer sandbox
                          <div className="thought-bubble bubble-idle bubble-idle-roster">
                            <span className="bubble-sandbox">⬡ wasmer sandbox</span>
                            idle · watching shared log
                          </div>
                        )}
                      </foreignObject>
                    );
                  })()}
                </g>
              );
            })}
          </g>
        </svg>

        {/* readable content for the current beat — email text, file content, creds */}
        {!wideShot && <FocusDetailCard event={lastEvent as TripwireEvent | null} />}
      </div>

      <ul className="legend">
        <li><span className="dot node-active" /> active</li>
        <li><span className="dot node-warning" /> warning</li>
        <li><span className="dot node-injected" /> injected</li>
        <li><span className="dot node-wandering" /> wandering</li>
        <li><span className="dot node-critical" /> critical</li>
        <li><span className="dot node-infected" /> infected</li>
        <li><span className="dot node-frozen" /> frozen</li>
      </ul>
    </div>
  );
}
