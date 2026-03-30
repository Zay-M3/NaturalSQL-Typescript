# NaturalSQL Typescript

NaturalSQL helps you transform SQL schema metadata into vector context so LLM workflows can map natural language requests into better SQL queries.

## Features

- Build vector metadata from live SQL schema.
- Search relevant tables by semantic similarity.
- Support for multiple SQL engines (sqlite, postgresql, mysql, sqlserver).
- Pluggable embedding providers (local transformers or Gemini).
- Pluggable vector stores (SQLite or Chroma).

## Install

Install the package:

```bash
npm i naturalsql
```

Then install optional dependencies according to your combination.

### sqlite + local

```bash
npm i @xenova/transformers better-sqlite3
```

### chroma + local

```bash
npm i @xenova/transformers chromadb
```

### sqlite + gemini

```bash
npm i @google/generative-ai better-sqlite3
```

### chroma + gemini

```bash
npm i @google/generative-ai chromadb
```

## Quick Start

```ts
import { NaturalSQL } from "naturalsql";

const nsql = new NaturalSQL({
	dbUrl: "sqlite:///./sample.db",
	dbType: "sqlite",
	vectorBackend: "sqlite",
	embeddingProvider: "local",
	vectorDistanceThreshold: 0.35
});

const build = await nsql.buildVectorDb("./metadata_vdb");
console.log(build);

const relevantTables = await nsql.search("customers with recent orders", {
	storagePath: "./metadata_vdb",
	limit: 3
});

console.log(relevantTables);
```

## API Surface

- NaturalSQL(options)
- getConfig()
- buildVectorDb(storagePath, options)
- search(request, options)

## Development

```bash
npm run test
npm run typecheck
npm run build
```

## License

Apache-2.0
