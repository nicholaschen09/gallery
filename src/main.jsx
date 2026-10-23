import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const PAGE_SIZE = 36;

function Icon({ name, size = 18 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function useColumnCount() {
  const [count, setCount] = useState(() => window.innerWidth < 620 ? 2 : window.innerWidth < 920 ? 3 : window.innerWidth < 1280 ? 4 : 5);
  useEffect(() => {
    const update = () => setCount(window.innerWidth < 620 ? 2 : window.innerWidth < 920 ? 3 : window.innerWidth < 1280 ? 4 : 5);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return count;
}

function VirtualMasonry({ items, onSimilar, selectedId }) {
  const columns = useColumnCount();
  const [scrollTop, setScrollTop] = useState(window.scrollY);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const layout = useMemo(() => {
    const heights = Array(columns).fill(0);
    const shellWidth = document.querySelector('.app-shell')?.clientWidth || window.innerWidth - 84;
    const colWidth = (shellWidth - (columns - 1) * 14) / columns;
    return items.map((item) => {
      const col = heights.indexOf(Math.min(...heights));
      const ratio = item.height / item.width;
      const height = Math.max(150, Math.min(520, colWidth * ratio));
      const top = heights[col];
      heights[col] += height + 14;
      return { item, col, top, height, left: col * (colWidth + 14), width: colWidth };
    });
  }, [items, columns]);
  const totalHeight = useMemo(() => layout.reduce((max, card) => Math.max(max, card.top + card.height), 0), [layout]);
  const visible = useMemo(() => layout.filter((card) => card.top + card.height >= scrollTop - viewportHeight * 1.2 && card.top <= scrollTop + viewportHeight * 2), [layout, scrollTop, viewportHeight]);

  useEffect(() => {
    let frame;
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
      {visible.map(({ item, col, top, left, width, height }) => <article className={`tile ${selectedId === item.id ? 'tile-selected' : ''}`} key={item.id} style={{ transform: `translate3d(${left}px, ${top}px, 0)`, width, height }}>
        <img src={item.thumbUrl} className="tile-blur" alt="" aria-hidden="true" />
        <img src={item.imageUrl} className="tile-photo" alt={item.title} loading={top < scrollTop + viewportHeight ? 'eager' : 'lazy'} decoding="async" onLoad={(event) => { event.currentTarget.classList.add('loaded'); event.currentTarget.parentElement.classList.add('image-loaded'); }} />
        <div className="tile-shade" />
        <div className="tile-info"><span>{item.title}</span><button aria-label={`Find images like ${item.title}`} title="Find similar" onClick={() => onSimilar(item)}><Icon name="spark" size={16}/></button></div>
        <span className="tile-category">{item.category}</span>
      </article>)}
    </div>
  </div>;
}

function App() {
  const [category, setCategory] = useState('All');
  const [orientation, setOrientation] = useState('Any');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [error, setError] = useState('');
  const sentinelRef = useRef(null);
  const requestRef = useRef(false);
  const requestControllerRef = useRef(null);

  const loadPage = useCallback(async ({ reset = false, selectedImage = null } = {}) => {
    if ((requestRef.current && !reset && !selectedImage) || (!hasMore && !reset && !selectedImage)) return;
    if (requestRef.current) requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    requestRef.current = true;
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (selectedImage) {
        if (category !== 'All') params.set('category', category);
      } else {
        params.set('category', category);
        params.set('orientation', orientation);
        if (activeQuery) params.set('q', activeQuery);
        if (!reset && cursor) params.set('cursor', cursor);
      }
      const url = selectedImage ? `/api/images/${selectedImage.id}/similar?${params}` : `/api/feed?${params}`;
      const response = await fetch(url, { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load images');
      if (controller.signal.aborted) return;
      const nextItems = payload.items || [];
      setItems((current) => reset || selectedImage ? nextItems : [...current, ...nextItems]);
      setCursor(payload.nextCursor || null);
      setHasMore(selectedImage ? false : Boolean(payload.nextCursor));
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      if (requestControllerRef.current === controller) {
        requestRef.current = false;
        setBusy(false);
      }
    }
  }, [category, orientation, activeQuery, cursor, hasMore]);

  useEffect(() => { setCursor(null); setHasMore(true); setSelected(null); loadPage({ reset: true }); }, [category, orientation, activeQuery]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadPage(); }, { rootMargin: '900px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadPage]);

  const findSimilar = (item) => {
    setSelected(item);
    setCursor(null);
    setHasMore(false);
    loadPage({ reset: true, selectedImage: item });
  };
  const submitSearch = (event) => {
    event.preventDefault();
    const nextQuery = searchText.trim();
    setSelected(null);
    setCursor(null);
    setHasMore(true);
    if (nextQuery === activeQuery) loadPage({ reset: true });
    else setActiveQuery(nextQuery);
  };
  return <main className="app-shell">
    <form className="search-bar" onSubmit={submitSearch} role="search">
      <Icon name="search" size={18}/>
      <input aria-label="Search assets by name" type="text" placeholder="Search assets by name" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
      {searchText && <button className="search-clear" type="button" aria-label="Clear search" onClick={() => { setSearchText(''); setSelected(null); setCursor(null); setHasMore(true); if (!activeQuery) loadPage({ reset: true }); else setActiveQuery(''); }}><Icon name="close" size={15}/></button>}
    </form>
    <VirtualMasonry items={items} onSimilar={findSimilar} selectedId={selected?.id}/>
    <div className="load-state" ref={sentinelRef}>{error ? <><span>{error}</span><button onClick={() => loadPage({ reset: items.length === 0, selectedImage: selected })}>Retry</button></> : busy ? <><span className="spinner"/>Gathering images</> : !hasMore ? <span>You've reached the edge of this collection.</span> : <span>Keep wandering</span>}</div>
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
