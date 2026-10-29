import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import type { FeedResponse, ImageRecord, SimilarResponse } from '../shared/types';
import { PAGE_SIZE } from './gallery';

interface LoadOptions {
  reset?: boolean;
  selectedImage?: ImageRecord | null;
}

export function useFeed(scroller: RefObject<HTMLDivElement | null>, prefetchPx = 900, pageSize = PAGE_SIZE) {
  const category = 'All';
  const orientation = 'Any';
  const [items, setItems] = useState<ImageRecord[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<ImageRecord | null>(null);
  const [searchText, setSearchText] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [error, setError] = useState('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef(false);
  const requestControllerRef = useRef<AbortController | null>(null);

  const loadPage = useCallback(async ({ reset = false, selectedImage = null }: LoadOptions = {}) => {
    if ((requestRef.current && !reset && !selectedImage) || (!hasMore && !reset && !selectedImage)) return;
    if (requestRef.current) requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    requestRef.current = true;
    setBusy(true);
    setError('');
    try {
      const firstPage = reset || !cursor;
      const limit = prefetchPx > 2000 ? Math.max(80, pageSize) : pageSize;
      const params = new URLSearchParams({ limit: String(limit) });
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
      const payload = await response.json() as (FeedResponse | SimilarResponse) & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not load images');
      if (controller.signal.aborted) return;
      const nextItems = payload.items || [];
      setItems((current) => reset || selectedImage ? nextItems : [...current, ...nextItems]);
      if (firstPage && 'total' in payload && typeof payload.total === 'number') setTotal(payload.total);
      const nextCursor = 'nextCursor' in payload ? payload.nextCursor : null;
      setCursor(nextCursor || null);
      setHasMore(selectedImage ? false : Boolean(nextCursor));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Could not load images');
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestRef.current = false;
        setBusy(false);
      }
    }
  }, [category, orientation, activeQuery, cursor, hasMore, prefetchPx, pageSize]);

  useEffect(() => { setCursor(null); setHasMore(true); setSelected(null); loadPage({ reset: true }); }, [category, orientation, activeQuery]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const root = scroller.current;
    if (!root) return;
    const margin = Math.max(900, Math.round(prefetchPx));
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) loadPage(); }, { root, rootMargin: `${margin}px` });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadPage, scroller, prefetchPx]);

  const findSimilar = (item: ImageRecord) => {
    setSelected(item);
    setCursor(null);
    setHasMore(false);
    loadPage({ reset: true, selectedImage: item });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = searchText.trim();
    setSelected(null);
    setCursor(null);
    setHasMore(true);
    if (nextQuery === activeQuery) loadPage({ reset: true });
    else setActiveQuery(nextQuery);
  };

  const clearSearch = () => {
    setSearchText('');
    setSelected(null);
    setCursor(null);
    setHasMore(true);
    if (!activeQuery) loadPage({ reset: true });
    else setActiveQuery('');
  };

  return { items, total, busy, error, hasMore, selected, searchText, setSearchText, sentinelRef, loadPage, findSimilar, submitSearch, clearSearch };
}
