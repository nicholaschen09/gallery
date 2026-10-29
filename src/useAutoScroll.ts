import { useEffect, useRef, useState } from 'react';

const PIXELS_PER_SECOND = 240;

export function useAutoScroll(hasMore: boolean) {
  const [active, setActive] = useState(false);
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  useEffect(() => {
    if (!active) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let timer = 0;
    let last = performance.now();
    const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const reachedEnd = () => window.scrollY >= maxScroll() - 1 && !hasMoreRef.current;
    if (reduceMotion) {
      const page = () => {
        if (reachedEnd()) { setActive(false); return; }
        const max = maxScroll();
        if (window.scrollY >= max - 1) return;
        window.scrollTo(0, Math.min(max, window.scrollY + window.innerHeight * 0.8));
      };
      page();
      timer = window.setInterval(page, 1400);
    } else {
      const step = (now: number) => {
        if (reachedEnd()) { setActive(false); return; }
        const max = maxScroll();
        if (window.scrollY < max - 1) {
          const dt = Math.min(now - last, 48);
          last = now;
          window.scrollTo(0, Math.min(max, window.scrollY + (PIXELS_PER_SECOND * dt) / 1000));
        }
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }
    const stop = () => setActive(false);
    const stopFromTouch = (event: TouchEvent) => {
      if (event.target instanceof Element && event.target.closest('.auto-scroll')) return;
      stop();
    };
    const stopFromKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) stop();
    };
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stopFromTouch, { passive: true });
    window.addEventListener('keydown', stopFromKey);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stopFromTouch);
      window.removeEventListener('keydown', stopFromKey);
    };
  }, [active]);

  return { active, setActive };
}
