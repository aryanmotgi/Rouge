import { cascadeAgentId } from '../types/events';

// Single source of truth for the cascade agent roster, shared by the mock
// scenarios, the network diagram, and the live-reasoning badge.
// 6 sits in the 5-10 range the brief asks for, and leaving one agent
// (agent_6) never touched by the cascade in the uncontained run is a
// deliberate demo beat: it shows the spread isn't "every agent auto-infects",
// it's specific agents that happened to read the poisoned shared update.
export const CASCADE_AGENT_COUNT = 6;
export const CASCADE_AGENTS = Array.from({ length: CASCADE_AGENT_COUNT }, (_, i) =>
  cascadeAgentId(i + 1),
);
export const INFECTED_AGENTS = CASCADE_AGENTS.slice(0, 5); // agent_1..agent_5

// email_agent + tenki_db + the cascade roster = the agents actually wired to
// real model calls during the demo. This is a fixed, known-ahead-of-time
// number — never derived from the event stream — because the whole point of
// the sandbox counter is to visually separate it from the ~100 fake
// sandboxes, which are cosmetic only.
export const LIVE_REASONING_AGENT_COUNT = CASCADE_AGENT_COUNT + 2;
