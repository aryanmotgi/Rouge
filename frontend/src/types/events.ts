// Shared event schema — fixed contract with the agent/backend tracks.
// Keep `actor` and `action` as plain strings (not enums): the backend teams
// own their own vocabulary, and the dashboard must not break if they emit an
// action or actor we haven't seen yet. Known values below are for our own
// derivation logic only, not a validation whitelist.

export interface TripwireEvent {
  time: string; // ISO 8601
  actor: string;
  action: string;
  target: string;
  detail: string;
  flagged: boolean;
  // escape hatch the backend fills with richer content the camera view renders:
  // read_file -> { file_content }, read_email -> { email_body, poisoned },
  // visited_url -> { decoy_url }, attempted_login -> { username }.
  extra?: Record<string, unknown>;
}

// Actors we know about ahead of time, for typing convenience in mock/derive code.
export const KNOWN_ACTORS = {
  emailAgent: 'email_agent',
  decoySite: 'decoy_billing_site',
  tenkiDb: 'tenki_db',
  sharedLog: 'shared_log',
} as const;

export const cascadeAgentId = (n: number) => `agent_${n}`;

// Actions we know about ahead of time, for typing convenience in mock/derive code.
export const KNOWN_ACTIONS = {
  readEmail: 'read_email',
  draftReply: 'draft_reply',
  openedFolder: 'opened_folder',
  accessedCredential: 'accessed_credential',
  readFile: 'read_file',
  visitedUrl: 'visited_url',
  decoyTriggered: 'decoy_triggered',
  attemptedLogin: 'attempted_login',
  reasoning: 'reasoning',
  sharedUpdatePosted: 'shared_update_posted',
  sharedUpdateRead: 'shared_update_read',
  freeze: 'freeze',
} as const;
