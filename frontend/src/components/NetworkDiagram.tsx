import { useEventStore } from '../state/eventStore';
import { NODE_LAYOUT, EDGE_LAYOUT } from './networkLayout';
import type { NodeStatus } from '../state/derive';
import './NetworkDiagram.css';

const NODE_RADIUS: Record<string, number> = {
  agent: 34,
  decoy: 30,
  db: 30,
  cascade: 22,
};

function nodeCenter(id: string) {
  const node = NODE_LAYOUT.find((n) => n.id === id);
  return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
}

export function NetworkDiagram() {
  const nodeStatus = useEventStore((s) => s.nodeStatus);
  const edgePulses = useEventStore((s) => s.edgePulses);
  const nodeActivity = useEventStore((s) => s.nodeActivity);

  // cascade agents form the idle roster (always shown); email_agent / decoy /
  // tenki_db "spawn" the first time an event touches them — that's the fade-in
  // + connect animation as the run unfolds.
  const isPresent = (id: string, kind: string) =>
    kind === 'cascade' || nodeStatus[id] !== undefined;
  const presentById = (id: string) => {
    const n = NODE_LAYOUT.find((node) => node.id === id);
    return n ? isPresent(n.id, n.kind) : false;
  };

  return (
    <div className="network-diagram">
      <h2 className="panel-title">Network</h2>
      <svg viewBox="0 0 1000 620" className="network-svg" role="img" aria-label="Agent network diagram">
        {EDGE_LAYOUT.filter((e) => presentById(e.from) && presentById(e.to)).map((edge) => {
          const from = nodeCenter(edge.from);
          const to = nodeCenter(edge.to);
          const pulse = edgePulses[edge.id];
          const status: NodeStatus = pulse?.status ?? 'idle';
          return (
            // key includes the pulse nonce so React remounts the element on
            // re-trigger, which restarts the CSS pulse animation even if the
            // same edge fires twice in a row.
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
          const status: NodeStatus = nodeStatus[node.id] ?? 'idle';
          const activity = nodeActivity[node.id];
          return (
            <g key={node.id} className={`node node-spawn node-${status}`} transform={`translate(${node.x},${node.y})`}>
              <circle r={NODE_RADIUS[node.kind]} className="node-circle" />
              <circle r={NODE_RADIUS[node.kind]} className="node-ring" />
              <text className="node-label" y={NODE_RADIUS[node.kind] + 16}>
                {node.label}
              </text>
              {activity && (
                // Keyed on the activity nonce so each new event remounts this
                // element — that's what makes it re-play its entrance
                // animation per email check instead of only once.
                <text key={activity.nonce} className="node-activity" y={NODE_RADIUS[node.kind] + 32}>
                  {activity.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

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
