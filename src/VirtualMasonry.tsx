import { useEffect, useMemo, useState } from 'react';
import type { RefObject, SyntheticEvent } from 'react';
import type { ImageRecord } from '../shared/types';
import { COLUMN_GAP, TILE_RATIO } from './gallery';
import { Icon } from './icons';

interface PositionedCard {
  item: ImageRecord;
  col: number;
  top: number;
  height: number;
  left: number;
  width: number;
}

function useScrollerMetrics(scroller: RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(() => Math.min(window.innerWidth, 1600) - (window.innerWidth < 700 ? 36 : 84));
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    let frame = 0;
    const read = () => {
      const nextWidth = node.clientWidth;
      if (nextWidth > 0) setWidth(nextWidth);
      setViewportHeight(node.clientHeight);
      setScrollTop(node.scrollTop);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrollTop(node.scrollTop));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      node.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [scroller]);
  return { width, scrollTop, viewportHeight };
}

export function VirtualMasonry({ items, onSimilar, selectedId, columns, scroller, scrollPixelsPerSecond = 0 }: { items: ImageRecord[]; onSimilar: (item: ImageRecord) => void; selectedId?: string; columns: number; scroller: RefObject<HTMLDivElement | null>; scrollPixelsPerSecond?: number }) {
  const { width: contentWidth, scrollTop, viewportHeight } = useScrollerMetrics(scroller);
  const layout = useMemo(() => {
    const heights = Array.from({ length: columns }, () => 0);
    const colWidth = (contentWidth - (columns - 1) * COLUMN_GAP) / columns;
    const tileHeight = colWidth * TILE_RATIO;
    return items.map((item): PositionedCard => {
      const col = heights.indexOf(Math.min(...heights));
      const top = heights[col] ?? 0;
      heights[col] = top + tileHeight + COLUMN_GAP;
      return { item, col, top, height: tileHeight, left: col * (colWidth + COLUMN_GAP), width: colWidth };
    });
  }, [items, columns, contentWidth]);
  const totalHeight = useMemo(() => layout.reduce((max, card) => Math.max(max, card.top + card.height), 0), [layout]);
  const visible = useMemo(() => {
    const lead = scrollPixelsPerSecond / 60;
    const ahead = Math.min(8000, Math.max(viewportHeight * 2, lead * 3));
    const behind = Math.min(2400, Math.max(viewportHeight * 1.2, lead));
    return layout.filter((card) => card.top + card.height >= scrollTop - behind && card.top <= scrollTop + ahead);
  }, [layout, scrollTop, viewportHeight, scrollPixelsPerSecond]);

  return <div className="scroll-area">
    <div className="masonry" style={{ height: totalHeight }}>
      {visible.map(({ item, top, left, width, height }) => <article className={`tile ${selectedId === item.id ? 'tile-selected' : ''} ${width < 180 ? 'tile-compact' : ''}`} key={`${item.id}-${item.width}x${item.height}`} style={{ transform: `translate3d(${left}px, ${top}px, 0)`, width, height }}>
        <img src={item.thumbUrl} className="tile-blur" alt="" aria-hidden="true" />
        <img src={item.imageUrl} className="tile-photo" alt={item.title} loading={top < scrollTop + viewportHeight ? 'eager' : 'lazy'} decoding="async" onLoad={(event: SyntheticEvent<HTMLImageElement>) => { event.currentTarget.classList.add('loaded'); event.currentTarget.parentElement?.classList.add('image-loaded'); }} />
        <div className="tile-shade" />
        <div className="tile-info"><span>{item.title}</span><button aria-label={`Find images like ${item.title}`} title="Find similar" onClick={() => onSimilar(item)}><Icon name="spark" size={16}/></button></div>
        <span className="tile-category">{item.category}</span>
      </article>)}
    </div>
  </div>;
}
