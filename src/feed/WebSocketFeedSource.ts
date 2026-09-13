import type { TripwireEvent } from '../types/events';
import type { FeedHandlers, FeedSource } from './FeedSource';

export class WebSocketFeedSource implements FeedSource {
  readonly capabilities = { controllable: false };

  private socket: WebSocket | null = null;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(handlers: FeedHandlers): void {
    handlers.onStatus?.('connecting');
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => handlers.onStatus?.('connected');
    socket.onerror = () => handlers.onStatus?.('error');
    socket.onclose = () => handlers.onStatus?.('disconnected');
    socket.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as TripwireEvent;
        handlers.onEvent(event);
      } catch (err) {
        console.error('WebSocketFeedSource: failed to parse event payload', err, msg.data);
      }
    };
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }
}
