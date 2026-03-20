/**
 * PRISM Yjs Collaboration Provider
 *
 * Manages Yjs documents for real-time collaborative editing of presentations.
 * Each PresentationVersion gets a Yjs document mirroring its SlideVersion content.
 *
 * Architecture:
 * - Yjs document per presentation version (room name = versionId)
 * - WebSocket provider (y-websocket) for real-time sync
 * - Awareness protocol for presence (cursors, active slide, user info)
 * - Periodic state flush to Prisma (every 5 seconds)
 *
 * Usage:
 *   const collab = new CollaborationSession(versionId, user);
 *   collab.connect();
 *   const slideContent = collab.getSlideContent(slideNumber);
 *   collab.updateSlideContent(slideNumber, { headline: "New title" });
 *   collab.destroy();
 */

import * as Y from "yjs";

// ─── Types ──────────────────────────────────────────────────

export interface CollaborationUser {
  id: string;
  name: string;
  email?: string;
  image?: string;
  color: string; // Cursor color
}

export interface PresenceState {
  user: CollaborationUser;
  activeSlide: number;
  cursor?: { field: string; offset: number };
  lastActive: number;
}

export interface SlideContentMap {
  headline?: string;
  body?: string;
  stats?: Array<{ label: string; value: string; prefix?: string; suffix?: string }>;
  findings?: Array<{ id: string; statement: string; confidence: string }>;
  sources?: string[];
}

// ─── Collaboration Session ──────────────────────────────────

export class CollaborationSession {
  readonly doc: Y.Doc;
  readonly versionId: string;
  readonly user: CollaborationUser;
  private provider: unknown = null; // WebSocketProvider - imported dynamically
  private awareness: unknown = null;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(versionId: string, user: CollaborationUser) {
    this.versionId = versionId;
    this.user = user;
    this.doc = new Y.Doc();
  }

  /**
   * Connect to the WebSocket server and start syncing.
   * Call this from a useEffect in the editor component.
   */
  async connect(wsUrl?: string): Promise<void> {
    if (this.destroyed) return;

    const url = wsUrl ?? (
      typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/collaboration`
        : "ws://localhost:3000/api/collaboration"
    );

    // Dynamic import to avoid SSR issues
    const { WebsocketProvider } = await import("y-websocket");
    const provider = new WebsocketProvider(url, this.versionId, this.doc);

    this.provider = provider;
    this.awareness = provider.awareness;

    // Set local awareness state
    provider.awareness.setLocalState({
      user: this.user,
      activeSlide: 1,
      lastActive: Date.now(),
    } satisfies PresenceState);

    // Start periodic DB flush
    this.flushInterval = setInterval(() => {
      this.flushToDatabase().catch(console.error);
    }, 5000);
  }

  /**
   * Get the Yjs Map for a specific slide's content.
   */
  getSlideMap(slideNumber: number): Y.Map<unknown> {
    return this.doc.getMap(`slide-${slideNumber}`);
  }

  /**
   * Get the current content of a slide as a plain object.
   */
  getSlideContent(slideNumber: number): SlideContentMap {
    const map = this.getSlideMap(slideNumber);
    return Object.fromEntries(map.entries()) as SlideContentMap;
  }

  /**
   * Update a slide's content. This is a Yjs transaction —
   * all changes are atomic and broadcast to other clients.
   */
  updateSlideContent(slideNumber: number, updates: Partial<SlideContentMap>): void {
    const map = this.getSlideMap(slideNumber);
    this.doc.transact(() => {
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          map.set(key, value);
        }
      }
    });
  }

  /**
   * Update the active slide in awareness (so other users see which slide you're on).
   */
  setActiveSlide(slideNumber: number): void {
    if (!this.awareness) return;
    const awareness = this.awareness as { setLocalStateField: (field: string, value: unknown) => void };
    awareness.setLocalStateField("activeSlide", slideNumber);
    awareness.setLocalStateField("lastActive", Date.now());
  }

  /**
   * Get all remote users' presence states.
   */
  getPresenceStates(): PresenceState[] {
    if (!this.awareness) return [];
    const awareness = this.awareness as {
      getStates: () => Map<number, PresenceState>;
      clientID: number;
    };
    const states: PresenceState[] = [];
    awareness.getStates().forEach((state, clientId) => {
      if (clientId !== awareness.clientID && state?.user) {
        states.push(state);
      }
    });
    return states;
  }

  /**
   * Register a callback for presence changes.
   */
  onPresenceChange(callback: (states: PresenceState[]) => void): () => void {
    if (!this.awareness) return () => {};
    const awareness = this.awareness as {
      on: (event: string, handler: () => void) => void;
      off: (event: string, handler: () => void) => void;
    };
    const handler = () => callback(this.getPresenceStates());
    awareness.on("change", handler);
    return () => awareness.off("change", handler);
  }

  /**
   * Flush current Yjs state to the database via API.
   */
  private async flushToDatabase(): Promise<void> {
    if (this.destroyed || typeof window === "undefined") return;

    // Collect all slide data from the Yjs document
    const slides: Record<number, SlideContentMap> = {};
    for (const key of this.doc.share.keys()) {
      const match = key.match(/^slide-(\d+)$/);
      if (match) {
        const slideNumber = parseInt(match[1], 10);
        slides[slideNumber] = this.getSlideContent(slideNumber);
      }
    }

    // Only flush if there's data to save
    if (Object.keys(slides).length === 0) return;

    try {
      await fetch(`/api/collaboration/flush`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: this.versionId,
          slides,
        }),
      });
    } catch {
      // Silent fail — will retry on next interval
    }
  }

  /**
   * Clean up: disconnect provider, stop flushing, destroy doc.
   */
  destroy(): void {
    this.destroyed = true;
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Final flush
    this.flushToDatabase().catch(() => {});
    if (this.provider) {
      const provider = this.provider as { destroy: () => void };
      provider.destroy();
    }
    this.doc.destroy();
  }
}

// ─── Cursor Colors ──────────────────────────────────────────

const CURSOR_COLORS = [
  "#59DDFD", // prism-sky
  "#F59E0B", // amber
  "#10B981", // emerald
  "#8B5CF6", // violet
  "#EF4444", // red
  "#EC4899", // pink
  "#6366F1", // indigo
  "#14B8A6", // teal
];

export function getCursorColor(index: number): string {
  return CURSOR_COLORS[index % CURSOR_COLORS.length];
}
