import { KNOWN_ACTORS } from '../types/events';
import { CASCADE_AGENTS } from '../mock/roster';
import { edgeId } from '../state/derive';

const { emailAgent, decoySite, tenkiDb } = KNOWN_ACTORS;

export interface NodeLayout {
  id: string;
  label: string;
  kind: 'agent' | 'decoy' | 'db' | 'cascade';
  x: number;
  y: number;
}

// Three evenly-spaced columns (170 / 540 / 910, 370px apart) across a
// 1000x620 canvas, with the decoy/db pair symmetric above and below the
// email_agent's vertical center, and the cascade column centered the same
// way — a deliberate, legible geometry rather than an organic cluster.
const AGENT_Y_START = 70;
const AGENT_Y_STEP = 96;

export const NODE_LAYOUT: NodeLayout[] = [
  { id: emailAgent, label: 'email_agent', kind: 'agent', x: 170, y: 310 },
  { id: decoySite, label: 'decoy_billing_site', kind: 'decoy', x: 540, y: 120 },
  { id: tenkiDb, label: 'tenki_db', kind: 'db', x: 540, y: 500 },
  ...CASCADE_AGENTS.map((id, i) => ({
    id,
    label: id,
    kind: 'cascade' as const,
    x: 910,
    y: AGENT_Y_START + i * AGENT_Y_STEP,
  })),
];

export interface EdgeLayout {
  id: string;
  from: string;
  to: string;
  variant: 'solid' | 'dashed';
}

export const EDGE_LAYOUT: EdgeLayout[] = [
  { id: edgeId(emailAgent, decoySite), from: emailAgent, to: decoySite, variant: 'solid' },
  { id: edgeId(emailAgent, tenkiDb), from: emailAgent, to: tenkiDb, variant: 'solid' },
  ...CASCADE_AGENTS.map((id) => ({
    id: edgeId(emailAgent, id),
    from: emailAgent,
    to: id,
    variant: 'dashed' as const,
  })),
];
