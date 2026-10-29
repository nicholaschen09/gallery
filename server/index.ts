import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { demoImages } from './demo-data.js';
import type { FeedResponse, GalleryMode, ImageRecord, SimilarResponse } from '../shared/types.js';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3001);
const here = path.dirname(fileURLToPath(import.meta.url));
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
app.use(express.json({ limit: '32kb' }));

interface CursorPayload {
  createdAt: string;
  id: string;
}

interface ImageRow {
  id: string;
  title: string;
  category: string;
  orientation: ImageRecord['orientation'];
  width: number;
  height: number;
  image_url: string;
  thumb_url: string;
  tags: string[];
  created_at: Date | string;
}

interface FeedParams {
  cursor?: string;
  category?: string;
  orientation?: string;
  query?: string;
  limit: number;
}

function encodeCursor(item: Pick<ImageRecord, 'createdAt' | 'id'>): string {
  const cursor: CursorPayload = { createdAt: item.createdAt, id: item.id };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.createdAt !== 'string' || typeof record.id !== 'string') return null;
    return { createdAt: record.createdAt, id: record.id };
  } catch {
    return null;
  }
}

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function shape(row: ImageRow): ImageRecord {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    orientation: row.orientation,
    width: row.width,
    height: row.height,
    imageUrl: row.image_url,
    thumbUrl: row.thumb_url,
    tags: row.tags,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function getFeed({ cursor, category, orientation, query, limit }: FeedParams): Promise<FeedResponse> {
  const decoded = cursor ? decodeCursor(cursor) : null;
  if (cursor && !decoded) throw new Error('Invalid cursor');

  if (pool) {
    const values: Array<string | number> = [];
    const where: string[] = [];
    if (category && category !== 'All') {
      values.push(category);
      where.push(`category = $${values.length}`);
    }
    if (orientation && orientation !== 'Any') {
      values.push(orientation.toLowerCase());
      where.push(`orientation = $${values.length}`);
    }
    if (query) {
      values.push(`%${query}%`);
      where.push(`(title ILIKE $${values.length} OR category ILIKE $${values.length} OR array_to_string(tags, ' ') ILIKE $${values.length})`);
    }
    if (decoded) {
      values.push(decoded.createdAt, decoded.id);
      where.push(`(created_at, id) < ($${values.length - 1}::timestamptz, $${values.length})`);
    }
    values.push(limit + 1);
    const result = await pool.query<ImageRow>(
      `SELECT id, title, category, orientation, width, height, image_url, thumb_url, tags, created_at
       FROM images ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY created_at DESC, id DESC LIMIT $${values.length}`,
      values,
    );
    const hasMore = result.rows.length > limit;
    const items = result.rows.slice(0, limit).map(shape);
    return { items, nextCursor: hasMore ? encodeCursor(items.at(-1)!) : null, total: null, mode: 'postgres' };
  }

  const browsingAll = (!category || category === 'All') && (!orientation || orientation === 'Any') && !query;
  if (browsingAll) {
    const start = decoded ? Number(decoded.id.replace(/^demo-/, '')) : 0;
    if (!Number.isInteger(start) || start < 0) throw new Error('Invalid cursor');
    const page = demoImages.slice(start, start + limit + 1);
    const hasMore = page.length > limit;
    const items = page.slice(0, limit);
    return { items, nextCursor: hasMore ? encodeCursor(items.at(-1)!) : null, total: demoImages.length, mode: 'demo' };
  }

  let rows = demoImages;
  if (category && category !== 'All') rows = rows.filter((item) => item.category === category);
  if (orientation && orientation !== 'Any') rows = rows.filter((item) => item.orientation === orientation.toLowerCase());
  if (query) {
    const normalized = query.toLowerCase();
    rows = rows.filter((item) => `${item.title} ${item.category} ${item.tags.join(' ')}`.toLowerCase().includes(normalized));
  }
  if (decoded) rows = rows.filter((item) => item.createdAt < decoded.createdAt || (item.createdAt === decoded.createdAt && item.id < decoded.id));
  const page = rows.slice(0, limit + 1);
  const hasMore = page.length > limit;
  const items = page.slice(0, limit);
  return { items, nextCursor: hasMore ? encodeCursor(items.at(-1)!) : null, total: rows.length, mode: 'demo' };
}

app.get('/api/health', async (_req, res) => {
  let database: 'demo' | 'connected' | 'unavailable' = 'demo';
  if (pool) {
    try {
      await pool.query('SELECT 1');
      database = 'connected';
    } catch {
      database = 'unavailable';
    }
  }
  res.json({ ok: database !== 'unavailable', database });
});

app.get('/api/feed', async (req, res) => {
  const started = performance.now();
  const requestedLimit = Number(queryString(req.query.limit)) || 36;
  const limit = Math.min(Math.max(requestedLimit, 1), 80);
  try {
    const result = await getFeed({
      cursor: queryString(req.query.cursor),
      category: queryString(req.query.category),
      orientation: queryString(req.query.orientation),
      query: queryString(req.query.q)?.trim(),
      limit,
    });
    res.set('Server-Timing', `feed;dur=${(performance.now() - started).toFixed(1)}`);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    res.status(message === 'Invalid cursor' ? 400 : 500).json({ error: message });
  }
});

app.get('/api/images/:id/similar', async (req, res) => {
  const started = performance.now();
  const requestedLimit = Number(queryString(req.query.limit)) || 24;
  const limit = Math.min(Math.max(requestedLimit, 1), 60);
  const category = queryString(req.query.category);
  try {
    let items: ImageRecord[];
    let mode: GalleryMode = 'demo';
    if (pool) {
      const values: Array<string | number> = [req.params.id];
      const where = ['i.id <> $1', 'i.embedding IS NOT NULL'];
      if (category && category !== 'All') {
        values.push(category);
        where.push(`i.category = $${values.length}`);
      }
      values.push(limit);
      const { rows } = await pool.query<ImageRow>(
        `SELECT i.id, i.title, i.category, i.orientation, i.width, i.height,
                i.image_url, i.thumb_url, i.tags, i.created_at
         FROM images i
         CROSS JOIN (SELECT embedding FROM images WHERE id = $1) q
         WHERE ${where.join(' AND ')}
         ORDER BY i.embedding <=> q.embedding
         LIMIT $${values.length}`,
        values,
      );
      items = rows.map(shape);
      mode = 'postgres';
    } else {
      const anchor = demoImages.find((item) => item.id === req.params.id);
      if (!anchor) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }
      items = demoImages.filter((item) => item.id !== anchor.id && item.category === anchor.category && (!category || category === 'All' || item.category === category)).slice(0, limit);
    }
    const result: SimilarResponse = { items, mode };
    res.set('Server-Timing', `similar;dur=${(performance.now() - started).toFixed(1)}`);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    res.status(500).json({ error: message });
  }
});

const sourceDist = path.resolve(here, '../dist');
const builtDist = path.resolve(here, '../../dist');
app.use(express.static(existsSync(path.join(sourceDist, 'index.html')) ? sourceDist : builtDist));
app.listen(port, () => console.log(`Gallery API listening on http://localhost:${port}`));
