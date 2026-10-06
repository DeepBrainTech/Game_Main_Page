"use client";

import { useCallback, useEffect, useState } from "react";

export function useSingleRowCapacity(itemCount: number) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState({ capacity: 1, cardWidth: 144 });
  const rowRef = useCallback((node: HTMLDivElement | null) => setElement(node), []);

  useEffect(() => {
    if (!element) return;

    const updateCapacity = () => {
      const styles = getComputedStyle(element);
      const padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const gap = parseFloat(styles.columnGap) || 0;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const targetCardWidth = parseFloat(styles.getPropertyValue("--item-target-width")) * rem;
      const width = element.getBoundingClientRect().width - padding;
      const peekWidth = parseFloat(styles.getPropertyValue("--item-peek")) * rem;
      const capacity = Math.max(1, Math.round((width - peekWidth) / (targetCardWidth + gap)));
      const cardWidth = Math.max(1, (width - capacity * gap - peekWidth) / capacity);
      setLayout((current) => current.capacity === capacity && current.cardWidth === cardWidth
        ? current
        : { capacity, cardWidth });
    };

    updateCapacity();
    const observer = new ResizeObserver(updateCapacity);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, itemCount]);

  return { rowRef, visibleCount: Math.min(itemCount, layout.capacity), ...layout };
}
