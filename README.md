# NaturalSQL TypeScript

Lightweight library to convert your SQL database schema into a vector database, so LLMs can use real table/column context to generate more accurate SQL from natural language.

## Problem

Sometimes you want to interact with SQL databases through an LLM without pulling in large frameworks with many unrelated features.

## Solution

NaturalSQL extracts your database schema, vectorizes it using a configurable backend (`chroma` or `sqlite`) and configurable embedding provider (`local` or `gemini`), then performs semantic retrieval to return relevant schema context for your LLM.

## Installation

```bash
# Base package
npm i naturalsql
```

Install optional dependencies based on your configuration:

```bash
# Chroma + local embeddings
npm i chromadb @xenova/transformers

# SQLite + local embeddings
npm i better-sqlite3 @xenova/transformers

# SQLite + Gemini embeddings
npm i better-sqlite3 @google/generative-ai

# Chroma + Gemini embeddings
npm i chromadb @google/generative-ai

# PostgreSQL driver support
npm i pg

# MySQL driver support
npm i mysql2

# SQL Server driver support
npm i mssql
```

> Node.js `>=18` is required.
> For Gemini, this package uses `@google/generative-ai`.
> Use environment variables for API keys (for example, `GEMINI_API_KEY`), never hardcode secrets.

## Supported SQL engines

- PostgreSQL
- MySQL
- SQL Server
- SQLite

## Quick start

```ts
import { NaturalSQL } from "naturalsql";

// 1) Create an instance
const nsql = new NaturalSQL({
	dbUrl: "postgresql://user:password@localhost:5432/mydb",
	dbType: "postgresql"
});

// 2) Build vector DB from schema
const result = await nsql.buildVectorDb("./metadata_vdb");
console.log(`Indexed tables: ${result.indexedTables}`);
console.log(`From cache: ${result.fromCache}`);

// 3) Retrieve relevant tables for a question
const tables = await nsql.search("Show me sales from last month", {
	storagePath: "./metadata_vdb",
	limit: 3
});

// 4) Use returned tables as LLM context
for (const table of tables) {
	console.log(table);
}
```

## Automatic cache

`buildVectorDb()` reuses existing vector storage when possible (same storage path + schema cache key), unless you pass `forceReset: true`.

Also, `search()` reuses the in-memory `VectorManager` instance for the same `storagePath`, reducing repeated initialization cost.

## E2E examples

```ts
import { NaturalSQL } from "naturalsql";

// A) Chroma + local
const nsql = new NaturalSQL({
	dbUrl: "postgresql://user:pass@localhost:5432/mydb",
	dbType: "postgresql",
	vectorBackend: "chroma",
	embeddingProvider: "local",
	vectorDistanceThreshold: 0.35
});

await nsql.buildVectorDb("./metadata_vdb", { forceReset: false });
const tables = await nsql.search("sales for the last month", {
	storagePath: "./metadata_vdb",
	limit: 3
});
console.log(tables);
```

```ts
import { NaturalSQL } from "naturalsql";

// B) SQLite + Gemini
const nsql = new NaturalSQL({
	dbUrl: "sqlite:///./app.db",
	dbType: "sqlite",
	vectorBackend: "sqlite",
	embeddingProvider: "gemini",
	geminiApiKey: process.env.GEMINI_API_KEY,
	geminiEmbeddingModel: "text-embedding-004"
});

await nsql.buildVectorDb("./metadata_vdb_sqlite", { forceReset: false });
const tables = await nsql.search("users with recent purchases", {
	storagePath: "./metadata_vdb_sqlite",
	limit: 3
});
console.log(tables);
```

## API

### `new NaturalSQL(options?)`

Creates an instance with DB and embedding configuration.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `dbUrl` | `string \| null` | `null` | Database connection URL |
| `dbType` | `string` | `"sqlite"` | Engine: `postgresql`, `mysql`, `sqlite`, `sqlserver` |
| `normalizeEmbeddings` | `boolean` | `true` | Normalize embedding vectors |
| `device` | `string` | `"cpu"` | Embedding device: `cpu` or `cuda` |
| `vectorBackend` | `"chroma" \| "sqlite"` | `"sqlite"` | Vector backend |
| `embeddingProvider` | `"local" \| "gemini"` | `"local"` | Embedding provider |
| `geminiApiKey` | `string \| null` | `null` | Required when `embeddingProvider="gemini"` |
| `geminiEmbeddingModel` | `string` | `"text-embedding-004"` | Gemini embedding model |
| `vectorDistanceThreshold` | `number` | `0.35` | Max distance threshold used by `search()` filtering |

Supported backend/provider combinations:

- `chroma + local`
- `sqlite + local`
- `sqlite + gemini`
- `chroma + gemini`

### `await nsql.buildVectorDb(storagePath, options?) -> BuildVectorDbResult`

Connects to the DB, extracts schema, and indexes it in the configured vector backend.

`storagePath` is required.

| Options | Type | Default | Description |
|---|---|---|---|
| `forceReset` | `boolean` | `false` | Rebuild vector collection from scratch |
| `cacheKey` | `string` | schema hash | Optional custom cache key |

Returns:

| Key | Type | Description |
|---|---|---|
| `storagePath` | `string` | Storage path used |
| `indexedTables` | `number` | Number of indexed tables |
| `fromCache` | `boolean` | `true` if existing vector store was reused |

### `await nsql.search(request, options?) -> string[]`

Retrieves semantically relevant tables for a natural-language question.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `request` | `string` | required | Natural-language question |
| `options.storagePath` | `string` | `"./metadata_vdb"` | Vector storage path |
| `options.limit` | `number` | `3` | Maximum number of tables to return |

### `buildPrompt(relevantTables, userQuestion) -> string`

Helper function in `naturalsql` to create an LLM prompt from relevant schema tables and a user question.

```ts
import { buildPrompt } from "naturalsql";

const prompt = buildPrompt(tables, "Show me sales from last month");
```

## Technical strategy

1. **Connection**: connects using native drivers (`pg`, `mysql2`, `mssql`) or SQLite support.
2. **Schema extraction**: uses metadata queries for PostgreSQL/MySQL/SQL Server or `PRAGMA table_info` for SQLite.
3. **Vectorization**: each table schema is transformed into a semantic document and indexed in configured backend (`chroma` or `sqlite`) with local or Gemini embeddings.
4. **Retrieval**: semantic nearest-neighbor search + `vectorDistanceThreshold` filtering.
5. **Caching**: vector index metadata cache + in-memory manager reuse to reduce repeated latency.

## Development

```bash
npm run test
npm run typecheck
npm run build
```

## License

[Apache-2.0](LICENSE)
