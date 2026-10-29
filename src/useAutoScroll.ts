import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useAutoScroll(hasMore: boolean, pixelsPerSecond: number, scroller: RefObject<HTMLDivElement | null>) {
  const [active, setActive] = useState(false);
  const hasMoreRef = useRef(hasMore);
  const speedRef = useRef(pixelsPerSecond);
  useLayoutEffect(() => {
    hasMoreRef.current = hasMore;
    speedRef.current = pixelsPerSecond;
  }, [hasMore, pixelsPerSecond]);

  useEffect(() => {
    if (!active) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let timer = 0;
    let last = performance.now();
    let carry = 0;
    const node = () => scroller.current;
    const maxScroll = () => {
      const el = node();
      return el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
    };
    const reachedEnd = () => {
      const el = node();
      return el !== null && el.scrollTop >= maxScroll() - 1 && !hasMoreRef.current;
    };
    if (reduceMotion) {
      const page = () => {
        const el = node();
        if (!el || reachedEnd()) { setActive(false); return; }
        const max = maxScroll();
        if (el.scrollTop < max - 1) el.scrollTo(0, Math.min(max, el.scrollTop + el.clientHeight * 0.8));
        const interval = Math.max(400, Math.round((1400 * 240) / Math.max(speedRef.current, 1)));
        timer = window.setTimeout(page, interval);
      };
      page();
    } else {
      const step = (now: number) => {
        const el = node();
        if (!el || reachedEnd()) { setActive(false); return; }
        const max = maxScroll();
        if (el.scrollTop < max - 1) {
          const dt = Math.min(now - last, 32);
          last = now;
          carry += (speedRef.current * dt) / 1000;
          const whole = Math.floor(carry);
          if (whole > 0) {
            const next = Math.min(max, el.scrollTop + whole);
            carry -= next - el.scrollTop;
            if (next >= max) carry = 0;
            el.scrollTo(0, next);
          }
        }
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }
    const stop = () => setActive(false);
    const stopFromTouch = (event: TouchEvent) => {
      if (event.target instanceof Element && event.target.closest('.scroll-controls')) return;
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
      window.clearTimeout(timer);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stopFromTouch);
      window.removeEventListener('keydown', stopFromKey);
    };
  }, [active, scroller]);

  return { active, setActive };
}
