import { create } from 'zustand';
import type { TripwireEvent } from '../types/events';
import type { FeedStatus } from '../feed/FeedSource';
import { deriveEffects, upgradeStatus, type NodeStatus } from './derive';

const PULSE_DURATION_MS = 1400;

// The two beats the presenter should be able to narrate before advancing. When
// one of these arrives live, we render it then auto-pause; a Continue resumes.
function flagStopReason(e: TripwireEvent): string | null {
  if (!e.flagged) return null;
  if (e.action === 'decoy_triggered')
    return 'Decoy touched — the agent connected to the fake billing portal.';
  if (e.action === 'attempted_login')
    return 'Login attempt — the agent used the planted credential against the trap DB.';
  return null;
}

interface EdgePulse {
  edgeId: string;
  status: NodeStatus;
  nonce: number; // bumped on every re-trigger so CSS animation restarts
}

interface NodeActivity {
  label: string; // the agent's live thought (event.detail)
  nonce: number; // bumped on every event so the tag remounts and re-animates
}

interface EventStoreState {
  events: TripwireEvent[]; // newest first
  nodeStatus: Record<string, NodeStatus>;
  edgePulses: Record<string, EdgePulse>;
  nodeActivity: Record<string, NodeActivity>;
  transportStatus: FeedStatus;
  // presenter pacing: paused freezes the reveal; incoming events queue in
  // `pending` (real events, just not shown yet) and drain on resume.
  paused: boolean;
  pausedReason: string | null;
  pending: TripwireEvent[];
  ingestEvent: (event: TripwireEvent) => void;
  setPaused: (paused: boolean) => void;
  resume: () => void;
  setTransportStatus: (status: FeedStatus) => void;
  reset: () => void;
}

let pulseCounter = 0;
let activityCounter = 0;
const pulseTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useEventStore = create<EventStoreState>((set, get) => {
  // apply ONE event to the visible scene (nodes/edges/log). Shared by live
  // ingest and by draining `pending` on resume.
  const applyOne = (event: TripwireEvent) => {
    const { nodeEffects, edgeEffects } = deriveEffects(event);

    set((state) => {
      const nodeStatus = { ...state.nodeStatus };
      for (const effect of nodeEffects) {
        nodeStatus[effect.nodeId] = upgradeStatus(nodeStatus[effect.nodeId] ?? 'idle', effect.status);
      }
      const edgePulses = { ...state.edgePulses };
      for (const effect of edgeEffects) {
        pulseCounter += 1;
        edgePulses[effect.edgeId] = { edgeId: effect.edgeId, status: effect.status, nonce: pulseCounter };
      }
      activityCounter += 1;
      const thought = (event.detail || event.target || '').slice(0, 46);
      const nodeActivity = {
        ...state.nodeActivity,
        [event.actor]: { label: thought, nonce: activityCounter },
      };
      return { events: [event, ...state.events], nodeStatus, edgePulses, nodeActivity };
    });

    for (const effect of edgeEffects) {
      const existing = pulseTimers.get(effect.edgeId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        set((state) => {
          const edgePulses = { ...state.edgePulses };
          delete edgePulses[effect.edgeId];
          return { edgePulses };
        });
        pulseTimers.delete(effect.edgeId);
      }, PULSE_DURATION_MS);
      pulseTimers.set(effect.edgeId, timer);
    }
  };

  return {
    events: [],
    nodeStatus: {},
    edgePulses: {},
    nodeActivity: {},
    transportStatus: 'idle',
    paused: false,
    pausedReason: null,
    pending: [],

    ingestEvent: (event) => {
      // paused by the presenter → queue the real event, don't reveal it yet
      if (get().paused) {
        set((state) => ({ pending: [...state.pending, event] }));
        return;
      }
      applyOne(event);
      // auto-pause AFTER showing a flag beat so the presenter can narrate it
      const reason = flagStopReason(event);
      if (reason) set({ paused: true, pausedReason: reason });
    },

    setPaused: (paused) =>
      set({ paused, pausedReason: paused ? 'Paused by presenter.' : null }),

    // Continue: drain queued events up to (and including) the next flag beat,
    // then auto-pause again — so beat-stepping survives even if the backend
    // finished while we were paused. If nothing left, go fully live.
    resume: () => {
      const queue = [...get().pending];
      set({ paused: false, pausedReason: null, pending: [] });
      while (queue.length) {
        const event = queue.shift() as TripwireEvent;
        applyOne(event);
        const reason = flagStopReason(event);
        if (reason) {
          set({ paused: true, pausedReason: reason, pending: queue });
          return;
        }
      }
    },

    setTransportStatus: (status) => set({ transportStatus: status }),

    reset: () => {
      pulseTimers.forEach(clearTimeout);
      pulseTimers.clear();
      set({
        events: [], nodeStatus: {}, edgePulses: {}, nodeActivity: {},
        paused: false, pausedReason: null, pending: [],
      });
    },
  };
});

export const getEventStoreState = () => useEventStore.getState();
