import { KNOWN_ACTIONS, KNOWN_ACTORS, type TripwireEvent } from '../types/events';

const { emailAgent, decoySite, tenkiDb } = KNOWN_ACTORS;
const A = KNOWN_ACTIONS;

// Ordered low -> high. A node only ever moves up this ladder within a run;
// it resets to 'idle' on scenario restart/switch, never mid-run, so the map
// reads as a persistent record of "what happened so far" during the demo.
export type NodeStatus = 'idle' | 'active' | 'warning' | 'critical' | 'infected' | 'frozen';
const RANK: Record<NodeStatus, number> = {
  idle: 0,
  active: 1,
  warning: 2,
  critical: 3,
  infected: 3,
  frozen: 4,
};

export function upgradeStatus(current: NodeStatus, next: NodeStatus): NodeStatus {
  return RANK[next] >= RANK[current] ? next : current;
}

export interface NodeEffect {
  nodeId: string;
  status: NodeStatus;
}

export interface EdgeEffect {
  edgeId: string; // `${from}->${to}`
  status: NodeStatus;
}

export interface DerivedEffects {
  nodeEffects: NodeEffect[];
  edgeEffects: EdgeEffect[];
}

export const edgeId = (from: string, to: string) => `${from}->${to}`;

/**
 * Maps a single event to node/edge highlight effects. Unknown actions are
 * safe no-ops — the diagram just won't light anything extra, which is the
 * right failure mode once a real backend starts sending actions we didn't
 * anticipate.
 */
export function deriveEffects(event: TripwireEvent): DerivedEffects {
  const nodeEffects: NodeEffect[] = [];
  const edgeEffects: EdgeEffect[] = [];

  switch (event.action) {
    case A.readEmail:
    case A.draftReply:
    case 'read_resource':
      nodeEffects.push({ nodeId: emailAgent, status: event.flagged ? 'warning' : 'active' });
      break;

    case A.visitedUrl:
      nodeEffects.push({ nodeId: emailAgent, status: 'warning' });
      if (event.target === decoySite) {
        nodeEffects.push({ nodeId: decoySite, status: 'active' });
        edgeEffects.push({ edgeId: edgeId(emailAgent, decoySite), status: 'warning' });
      }
      break;

    case A.decoyTriggered:
      nodeEffects.push({ nodeId: decoySite, status: 'warning' });
      edgeEffects.push({ edgeId: edgeId(emailAgent, decoySite), status: 'warning' });
      break;

    case A.attemptedLogin:
      nodeEffects.push({ nodeId: emailAgent, status: 'critical' });
      nodeEffects.push({ nodeId: tenkiDb, status: 'warning' });
      edgeEffects.push({ edgeId: edgeId(emailAgent, tenkiDb), status: 'critical' });
      break;

    case A.reasoning:
      if (event.actor === tenkiDb && event.flagged) {
        nodeEffects.push({ nodeId: tenkiDb, status: 'critical' });
      }
      break;

    case A.sharedUpdatePosted:
      nodeEffects.push({ nodeId: emailAgent, status: 'critical' });
      break;

    case A.sharedUpdateRead:
      if (event.flagged) {
        nodeEffects.push({ nodeId: event.actor, status: 'infected' });
        edgeEffects.push({ edgeId: edgeId(emailAgent, event.actor), status: 'infected' });
      }
      break;

    case A.freeze:
      nodeEffects.push({ nodeId: event.actor, status: 'frozen' });
      break;

    default:
      break;
  }

  return { nodeEffects, edgeEffects };
}

export interface Counters {
  decoysTouched: number;
  breachConfirmed: boolean;
  agentsInfected: number;
  infectedAgentIds: string[];
}

/**
 * Pure scan over the full event stream — counters are always a function of
 * `events`, never mutated independently, so there's no way for the panel to
 * drift out of sync with the log.
 */
export function deriveCounters(events: TripwireEvent[]): Counters {
  let decoysTouched = 0;
  let breachConfirmed = false;
  const infected = new Set<string>();

  for (const event of events) {
    if (event.action === A.decoyTriggered) decoysTouched += 1;
    if (event.action === A.reasoning && event.actor === tenkiDb && event.flagged) {
      breachConfirmed = true;
    }
    if (event.action === A.sharedUpdateRead && event.flagged) {
      infected.add(event.actor);
    }
  }

  return {
    decoysTouched,
    breachConfirmed,
    agentsInfected: infected.size,
    infectedAgentIds: [...infected],
  };
}
