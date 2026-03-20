/**
 * React Hook: useCollaboration
 *
 * Provides real-time collaborative editing for presentations via Yjs.
 * Manages the CollaborationSession lifecycle, presence states, and
 * slide content sync.
 *
 * Usage:
 *   const { isConnected, peers, updateSlide } = useCollaboration({
 *     versionId: "clxyz...",
 *     user: { id: "user1", name: "Jared", color: "#59DDFD" },
 *     activeSlide: 1,
 *   });
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CollaborationSession,
  getCursorColor,
  type CollaborationUser,
  type PresenceState,
  type SlideContentMap,
} from "@/lib/collaboration/yjs-provider";

interface UseCollaborationOptions {
  versionId: string | null;
  user: CollaborationUser | null;
  activeSlide: number;
  enabled?: boolean;
}

interface UseCollaborationReturn {
  isConnected: boolean;
  peers: PresenceState[];
  updateSlide: (slideNumber: number, content: Partial<SlideContentMap>) => void;
  getSlideContent: (slideNumber: number) => SlideContentMap;
}

export function useCollaboration({
  versionId,
  user,
  activeSlide,
  enabled = true,
}: UseCollaborationOptions): UseCollaborationReturn {
  const sessionRef = useRef<CollaborationSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<PresenceState[]>([]);

  // Reset state when disabled (outside of effect to avoid cascading renders)
  const shouldConnect = enabled && !!versionId && !!user;

  // Connect/disconnect on versionId or user changes
  useEffect(() => {
    if (!shouldConnect) {
      return;
    }

    const session = new CollaborationSession(versionId, user);
    sessionRef.current = session;

    session
      .connect()
      .then(() => {
        setIsConnected(true);
        // Listen for presence changes
        const unsubscribe = session.onPresenceChange((states) => {
          setPeers(states);
        });
        return unsubscribe;
      })
      .catch((err) => {
        console.error("[useCollaboration] Connection failed:", err);
        setIsConnected(false);
      });

    return () => {
      session.destroy();
      sessionRef.current = null;
      setIsConnected(false);
      setPeers([]);
    };
  }, [versionId, user?.id, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync active slide to awareness
  useEffect(() => {
    sessionRef.current?.setActiveSlide(activeSlide);
  }, [activeSlide]);

  const updateSlide = useCallback(
    (slideNumber: number, content: Partial<SlideContentMap>) => {
      sessionRef.current?.updateSlideContent(slideNumber, content);
    },
    [],
  );

  const getSlideContent = useCallback(
    (slideNumber: number): SlideContentMap => {
      return sessionRef.current?.getSlideContent(slideNumber) ?? {};
    },
    [],
  );

  return { isConnected, peers, updateSlide, getSlideContent };
}

export { getCursorColor };
export type { CollaborationUser, PresenceState, SlideContentMap };
