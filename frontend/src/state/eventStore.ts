import { create } from 'zustand';
import type { TripwireEvent } from '../types/events';
import type { FeedStatus } from '../feed/FeedSource';
import { deriveEffects, upgradeStatus, type NodeStatus } from './derive';

const PULSE_DURATION_MS = 1400;

interface EdgePulse {
  edgeId: string;
  status: NodeStatus;
  nonce: number; // bumped on every re-trigger so CSS animation restarts
}

interface NodeActivity {
  label: string; // the event's target — what the node is doing right now
  nonce: number; // bumped on every event so the tag remounts and re-animates
}

interface EventStoreState {
  events: TripwireEvent[]; // newest first
  nodeStatus: Record<string, NodeStatus>;
  edgePulses: Record<string, EdgePulse>;
  nodeActivity: Record<string, NodeActivity>;
  transportStatus: FeedStatus;
  ingestEvent: (event: TripwireEvent) => void;
  setTransportStatus: (status: FeedStatus) => void;
  reset: () => void;
}

let pulseCounter = 0;
let activityCounter = 0;
const pulseTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useEventStore = create<EventStoreState>((set) => ({
  events: [],
  nodeStatus: {},
  edgePulses: {},
  nodeActivity: {},
  transportStatus: 'idle',

  ingestEvent: (event) => {
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
      // show the agent's real thought (reasoning detail) under its node; fall
      // back to the target when there's no detail. Truncated to fit the label.
      const thought = (event.detail || event.target || '').slice(0, 46);
      const nodeActivity = {
        ...state.nodeActivity,
        [event.actor]: { label: thought, nonce: activityCounter },
      };

      return {
        events: [event, ...state.events],
        nodeStatus,
        edgePulses,
        nodeActivity,
      };
    });

    // Edges pulse transiently (nodes stay lit — see upgradeStatus).
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
  },

  setTransportStatus: (status) => set({ transportStatus: status }),

  reset: () => {
    pulseTimers.forEach(clearTimeout);
    pulseTimers.clear();
    set({ events: [], nodeStatus: {}, edgePulses: {}, nodeActivity: {} });
  },
}));

export const getEventStoreState = () => useEventStore.getState();
