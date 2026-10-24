# Gallery

Gallery is a visual discovery app starter: a masonry image feed, cursor pagination, metadata filters, and an API path for pgvector-based similar-image search.

The browser app and API are written in TypeScript. Shared image and API response types live in `src/types.ts`.

## Run the front end and demo API

```sh
npm install
npm run dev
```

Open <http://localhost:5173>. Without `DATABASE_URL`, the API serves a small curated demo dataset. The displayed response time is the browser-observed request time; it is a demo UI metric, not a scale benchmark.

## Start PostgreSQL with pgvector

```sh
docker compose up -d db
cp .env.example .env
npm start
```

The schema is in `db/init.sql`. To use the database API in development, set `DATABASE_URL=postgres://gallery:gallery@localhost:5432/gallery` and run `npm run dev`.

For production, run `npm run build` before `npm start`. The build type-checks the browser app, builds the Vite assets, and compiles the API into `dist/server`.

The database path expects image rows with metadata and 512-dimensional embeddings. This starter does not yet include ingestion, image storage, or embedding generation. Similar-image search becomes active when rows have embeddings; the demo mode groups images by category to make the interaction explorable without a model or database.

## API

- `GET /api/feed?limit=36&q=mountain&category=Nature&orientation=Portrait&cursor=...` — searchable, descending, keyset-paginated feed. Search matches titles, categories, and tags.
- `GET /api/images/:id/similar?limit=24&category=All` — nearest neighbors by cosine distance when PostgreSQL is configured.
- `GET /api/health` — reports whether the API is using the demo set or PostgreSQL.

## Next build steps

1. Add image ingestion to object storage and generate thumbnails plus normalized image embeddings.
2. Add a benchmark command that loads representative metadata and reports p50/p95 feed and vector-search latency, recall@k, dataset size, and index settings.
3. Profile scrolling with 100k+ records and tune the virtualized masonry window against frame time and memory.
