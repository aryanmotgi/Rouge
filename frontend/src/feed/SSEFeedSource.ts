import type { TripwireEvent } from '../types/events';
import type { FeedHandlers, FeedSource } from './FeedSource';

export class SSEFeedSource implements FeedSource {
  readonly capabilities = { controllable: false };

  private eventSource: EventSource | null = null;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(handlers: FeedHandlers): void {
    handlers.onStatus?.('connecting');
    const es = new EventSource(this.url);
    this.eventSource = es;

    es.onopen = () => handlers.onStatus?.('connected');
    es.onerror = () => handlers.onStatus?.('error');
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as TripwireEvent;
        handlers.onEvent(event);
      } catch (err) {
        console.error('SSEFeedSource: failed to parse event payload', err, msg.data);
      }
    };
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }
}
