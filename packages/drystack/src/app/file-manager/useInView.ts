import { useCallback, useEffect, useRef, useState } from 'react';

// Tracks whether the observed element is near the viewport, so callers can
// defer expensive work (e.g. fetching a thumbnail's blob content) until the
// item is actually about to be seen instead of doing it for every item in a
// long, unvirtualized list on mount.
//
// Uses a *callback ref* rather than observing in a mount effect: a cell can
// render without its target node on the first pass (e.g. a collection-table
// ImageCell shows an empty placeholder until the row's data loads, only then
// mounting the <div ref={ref}>). A mount effect reads ref.current === null and
// never retries; a callback ref fires whenever the node actually attaches, so
// the observer gets wired up even when the element appears after first render.
export function useInView<T extends HTMLElement>(rootMargin = '400px') {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const disconnect = () => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  };

  const ref = useCallback(
    (node: T | null) => {
      // drop any prior observation before (re)wiring — React calls this with
      // null on detach and with the new node on attach
      disconnect();
      if (!node) return;
      if (typeof IntersectionObserver === 'undefined') {
        setInView(true);
        return;
      }
      const observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            setInView(true);
            disconnect(); // one-shot: once seen, stop observing
          }
        },
        { rootMargin }
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [rootMargin]
  );

  // guard against the node being torn down without a final null callback
  useEffect(() => disconnect, []);

  return [ref, inView] as const;
}
