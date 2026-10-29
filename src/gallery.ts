import type { ImageRecord } from '../shared/types';

export const PAGE_SIZE = 36;
export const COLUMN_GAP = 14;
export const TILE_RATIO = 9 / 16;

export const RESOLUTION_FILTERS = [
  { id: 'extreme-low', label: 'Extreme low', width: 256, height: 144 },
  { id: '720p', label: '720p', width: 1280, height: 720 },
  { id: '1080p', label: '1080p', width: 1920, height: 1080 },
  { id: '4k', label: '4K', width: 3840, height: 2160 },
  { id: 'extreme-high', label: 'Extreme high', width: 7680, height: 4320 },
] as const;

export const LAYOUTS = [
  { id: '2', label: '2×', columns: 2 },
  { id: '4', label: '4×', columns: 4 },
  { id: '6', label: '6×', columns: 6 },
  { id: '8', label: '8×', columns: 8 },
] as const;

/** Left end of the slider. Slow enough to actually watch a tile go by. */
export const SCROLL_SPEED_MIN = 80;
/**
 * Right end of the slider. At 60fps this is several pane-heights per frame,
 * fast enough that the pictures smear instead of reading as individual tiles.
 */
export const SCROLL_SPEED_MAX = 240_000;
/** Maps to about 240px/s, the pace auto-scroll used before the slider. */
export const DEFAULT_SCROLL_PERCENT = 14;

export type ResolutionId = (typeof RESOLUTION_FILTERS)[number]['id'];
export type ResolutionFilter = (typeof RESOLUTION_FILTERS)[number];
export type LayoutId = (typeof LAYOUTS)[number]['id'];

export function scrollSpeedFromPercent(percent: number): number {
  const t = Math.min(1, Math.max(0, percent / 100));
  return Math.round(SCROLL_SPEED_MIN * (SCROLL_SPEED_MAX / SCROLL_SPEED_MIN) ** t);
}

function resizeImageUrl(url: string, width: number, height: number): string {
  try {
    const parsed = new URL(url);
    const canResize = parsed.hostname.endsWith('unsplash.com') || parsed.searchParams.has('w');
    if (!canResize) return url;
    parsed.searchParams.set('w', String(width));
    parsed.searchParams.set('h', String(height));
    parsed.searchParams.set('fit', parsed.searchParams.get('fit') || 'crop');
    if (width >= 7000) parsed.searchParams.set('q', '50');
    else if (width >= 3840) parsed.searchParams.set('q', '70');
    return parsed.toString();
  } catch {
    return url;
  }
}

export function applyResolution(item: ImageRecord, filter: ResolutionFilter): ImageRecord {
  return {
    ...item,
    width: filter.width,
    height: filter.height,
    imageUrl: resizeImageUrl(item.imageUrl, filter.width, filter.height),
  };
}
