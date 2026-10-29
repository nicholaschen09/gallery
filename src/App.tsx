import { useEffect, useMemo, useState } from 'react';
import { applyResolution, LAYOUTS, RESOLUTION_FILTERS } from './gallery';
import type { LayoutId, ResolutionId } from './gallery';
import { Icon } from './icons';
import { useAutoScroll } from './useAutoScroll';
import { useFeed } from './useFeed';
import { VirtualMasonry } from './VirtualMasonry';

export function App() {
  const { items, busy, error, hasMore, selected, searchText, setSearchText, sentinelRef, loadPage, findSimilar, submitSearch, clearSearch } = useFeed();
  const { active: autoScroll, setActive: setAutoScroll } = useAutoScroll(hasMore);
  const [resolutionId, setResolutionId] = useState<ResolutionId | null>(null);
  const [layoutId, setLayoutId] = useState<LayoutId>('4');
  const resolution = RESOLUTION_FILTERS.find((filter) => filter.id === resolutionId) ?? null;
  const layout = LAYOUTS.find((item) => item.id === layoutId) ?? LAYOUTS[1];
  const visibleItems = useMemo(() => resolution ? items.map((item) => applyResolution(item, resolution)) : items, [items, resolution]);

  useEffect(() => { window.scrollTo(0, 0); }, [resolutionId, layoutId]);

  return <main className="app-shell">
    <form className="search-bar" onSubmit={submitSearch} role="search">
      <Icon name="search" size={18}/>
      <input aria-label="Search assets by name" type="text" placeholder="Search assets by name" value={searchText} onChange={(event) => setSearchText(event.currentTarget.value)} />
      {searchText && <button className="search-clear" type="button" aria-label="Clear search" onClick={clearSearch}><Icon name="close" size={15}/></button>}
    </form>
    <div className="resolution-row">
      <span className="resolution-label">Resolution</span>
      <div className="resolution-filters" role="group" aria-label="Resolution">
        {RESOLUTION_FILTERS.map((filter) => <button key={filter.id} type="button" aria-pressed={resolutionId === filter.id} className={resolutionId === filter.id ? 'filter-active' : ''} title={`Load every image at ${filter.width}×${filter.height}`} onClick={() => setResolutionId((current) => current === filter.id ? null : filter.id)}>{filter.label}</button>)}
      </div>
      {resolution && <span className="resolution-status">Every image is {resolution.width}×{resolution.height}</span>}
    </div>
    <div className="resolution-row">
      <span className="resolution-label">Layout</span>
      <div className="resolution-filters" role="group" aria-label="Layout">
        {LAYOUTS.map((item) => <button key={item.id} type="button" aria-pressed={layoutId === item.id} className={layoutId === item.id ? 'filter-active' : ''} title={`Show ${item.columns} columns`} onClick={() => setLayoutId(item.id)}>{item.label}</button>)}
      </div>
    </div>
    <VirtualMasonry items={visibleItems} onSimilar={findSimilar} selectedId={selected?.id} columns={layout.columns}/>
    <div className="load-state" ref={sentinelRef}>{error ? <><span>{error}</span><button onClick={() => loadPage({ reset: items.length === 0, selectedImage: selected })}>Retry</button></> : busy ? <><span className="spinner"/>Gathering images</> : !hasMore ? <span>You've reached the edge of this collection.</span> : <span>Keep wandering</span>}</div>
    <button type="button" className={`auto-scroll ${autoScroll ? 'filter-active' : ''}`} aria-pressed={autoScroll} onClick={() => setAutoScroll((current) => !current)}>{autoScroll ? <><Icon name="pause" size={14}/>Pause</> : <><Icon name="play" size={14}/>Auto scroll</>}</button>
  </main>;
}
