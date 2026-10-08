"use client";

import { useEffect, useRef, useState } from "react";

export function useToastAutoDismiss(duration: number, paused: boolean, onDismiss: () => void) {
  const remainingRef = useRef(duration);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (paused || !pageVisible) return;

    const startedAt = performance.now();
    const timer = window.setTimeout(() => onDismissRef.current(), remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (performance.now() - startedAt));
    };
  }, [paused, pageVisible]);
}
