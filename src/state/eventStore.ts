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

interface EventStoreState {
  events: TripwireEvent[]; // newest first
  nodeStatus: Record<string, NodeStatus>;
  edgePulses: Record<string, EdgePulse>;
  transportStatus: FeedStatus;
  ingestEvent: (event: TripwireEvent) => void;
  setTransportStatus: (status: FeedStatus) => void;
  reset: () => void;
}

let pulseCounter = 0;
const pulseTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useEventStore = create<EventStoreState>((set) => ({
  events: [],
  nodeStatus: {},
  edgePulses: {},
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

      return {
        events: [event, ...state.events],
        nodeStatus,
        edgePulses,
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
    set({ events: [], nodeStatus: {}, edgePulses: {} });
  },
}));

export const getEventStoreState = () => useEventStore.getState();
