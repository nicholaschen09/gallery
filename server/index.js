import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoImages } from './demo-data.js';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3001);
const here = path.dirname(fileURLToPath(import.meta.url));
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
app.use(express.json({ limit: '32kb' }));

const encodeCursor = (item) => Buffer.from(JSON.stringify({ createdAt: item.createdAt, id: item.id })).toString('base64url');
const decodeCursor = (cursor) => {
  try { return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); }
  catch { return null; }
};
const shape = (row) => ({
  id: row.id, title: row.title, category: row.category, orientation: row.orientation,
  width: row.width, height: row.height, imageUrl: row.image_url ?? row.imageUrl,
  thumbUrl: row.thumb_url ?? row.thumbUrl, tags: row.tags ?? [], createdAt: row.created_at ?? row.createdAt,
});

async function getFeed({ cursor, category, orientation, query, limit }) {
  const decoded = cursor ? decodeCursor(cursor) : null;
  if (cursor && !decoded?.createdAt) throw new Error('Invalid cursor');
  if (pool) {
    const values = [];
    const where = [];
    if (category && category !== 'All') { values.push(category); where.push(`category = $${values.length}`); }
    if (orientation && orientation !== 'Any') { values.push(orientation.toLowerCase()); where.push(`orientation = $${values.length}`); }
    if (query) {
      values.push(`%${query}%`);
      where.push(`(title ILIKE $${values.length} OR category ILIKE $${values.length} OR array_to_string(tags, ' ') ILIKE $${values.length})`);
    }
    if (decoded) {
      values.push(decoded.createdAt, decoded.id);
      where.push(`(created_at, id) < ($${values.length - 1}::timestamptz, $${values.length})`);
    }
    values.push(limit + 1);
    const result = await pool.query(
      `SELECT id, title, category, orientation, width, height, image_url, thumb_url, tags, created_at
       FROM images ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY created_at DESC, id DESC LIMIT $${values.length}`,
      values,
    );
    const hasMore = result.rows.length > limit;
    const items = result.rows.slice(0, limit).map(shape);
    return { items, nextCursor: hasMore ? encodeCursor(items.at(-1)) : null, total: null, mode: 'postgres' };
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
  return { items, nextCursor: hasMore ? encodeCursor(items.at(-1)) : null, total: rows.length, mode: 'demo' };
}

app.get('/api/health', async (_req, res) => {
  let database = 'demo';
  if (pool) {
    try { await pool.query('SELECT 1'); database = 'connected'; }
    catch { database = 'unavailable'; }
  }
  res.json({ ok: database !== 'unavailable', database });
});

app.get('/api/feed', async (req, res) => {
  const started = performance.now();
  const limit = Math.min(Math.max(Number(req.query.limit) || 36, 1), 80);
  try {
    const result = await getFeed({ cursor: req.query.cursor, category: req.query.category, orientation: req.query.orientation, query: String(req.query.q || '').trim(), limit });
    res.set('Server-Timing', `feed;dur=${(performance.now() - started).toFixed(1)}`);
    res.json(result);
  } catch (error) {
    res.status(error.message === 'Invalid cursor' ? 400 : 500).json({ error: error.message });
  }
});

app.get('/api/images/:id/similar', async (req, res) => {
  const started = performance.now();
  const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 60);
  const category = req.query.category;
  try {
    let items;
    let mode = 'demo';
    if (pool) {
      const values = [req.params.id];
      const where = ['i.id <> $1', 'i.embedding IS NOT NULL'];
      if (category && category !== 'All') { values.push(category); where.push(`i.category = $${values.length}`); }
      values.push(limit);
      const { rows } = await pool.query(
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
      if (!anchor) return res.status(404).json({ error: 'Image not found' });
      items = demoImages.filter((item) => item.id !== anchor.id && item.category === anchor.category && (!category || category === 'All' || item.category === category)).slice(0, limit);
    }
    res.set('Server-Timing', `similar;dur=${(performance.now() - started).toFixed(1)}`);
    res.json({ items, mode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static(path.resolve(here, '../dist')));
app.listen(port, () => console.log(`Still API listening on http://localhost:${port}`));
