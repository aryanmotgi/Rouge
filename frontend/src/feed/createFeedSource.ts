import { feedConfig } from './config';
import type { FeedSource } from './FeedSource';
import { MockFeedSource } from './MockFeedSource';
import { SSEFeedSource } from './SSEFeedSource';
import { WebSocketFeedSource } from './WebSocketFeedSource';

// The one place transport choice is made. Everything above this (store,
// components) only ever sees the FeedSource interface.
export function createFeedSource(): FeedSource {
  switch (feedConfig.transport) {
    case 'sse':
      return new SSEFeedSource(feedConfig.eventsUrl);
    case 'websocket':
      return new WebSocketFeedSource(feedConfig.eventsUrl);
    case 'mock':
    default:
      return new MockFeedSource(feedConfig.initialScenario);
  }
}
