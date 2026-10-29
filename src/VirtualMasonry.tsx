import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';
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

function useContentWidth(): number {
  const [width, setWidth] = useState(() => Math.min(window.innerWidth, 1600) - (window.innerWidth < 700 ? 36 : 84));
  useLayoutEffect(() => {
    const read = () => {
      const shell = document.querySelector('.app-shell');
      if (!shell) return;
      const style = getComputedStyle(shell);
      const next = shell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (next > 0) setWidth(next);
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return width;
}

export function VirtualMasonry({ items, onSimilar, selectedId, columns }: { items: ImageRecord[]; onSimilar: (item: ImageRecord) => void; selectedId?: string; columns: number }) {
  const contentWidth = useContentWidth();
  const [scrollTop, setScrollTop] = useState(window.scrollY);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
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
  const visible = useMemo(() => layout.filter((card) => card.top + card.height >= scrollTop - viewportHeight * 1.2 && card.top <= scrollTop + viewportHeight * 2), [layout, scrollTop, viewportHeight]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrollTop(window.scrollY));
    };
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); cancelAnimationFrame(frame); };
  }, []);

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
