export type ImageOrientation = 'portrait' | 'landscape' | 'square';
export type GalleryMode = 'demo' | 'postgres';

export interface ImageRecord {
  id: string;
  title: string;
  category: string;
  orientation: ImageOrientation;
  width: number;
  height: number;
  imageUrl: string;
  thumbUrl: string;
  tags: string[];
  createdAt: string;
}

export interface FeedResponse {
  items: ImageRecord[];
  nextCursor: string | null;
  total: number | null;
  mode: GalleryMode;
}

export interface SimilarResponse {
  items: ImageRecord[];
  mode: GalleryMode;
}
