import { VectorStore } from "./base.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

type SQLiteDatabase = {
    prepare(sql: string): {
        run(...params: unknown[]): unknown;
        all(...params: unknown[]): Array<{ content: string; embedding: string }>;
    };
    exec(sql: string): void;
    close(): void;
};

type SQLiteModule = {
    default: new (filePath: string) => SQLiteDatabase;
};

type SQLiteStoreOptions = {
    storagePath: string;
    tableName?: string;
    resetOnStart?: boolean;
    loader?: () => Promise<SQLiteModule>;
};

export class SQLiteVectorStore extends VectorStore {
    private readonly storagePath: string;
    private readonly tableName: string;
    private readonly resetOnStart: boolean;
    private readonly loader: () => Promise<SQLiteModule>;
    private dbPromise?: Promise<SQLiteDatabase>;

    constructor(options: SQLiteStoreOptions = { storagePath: ".naturalsql" }) {
        super();
        this.storagePath = options.storagePath;
        this.tableName = options.tableName ?? "vectors";
        this.resetOnStart = options.resetOnStart ?? false;
        this.loader = options.loader ?? this.defaultLoader;

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(this.tableName)) {
            throw new Error("Invalid SQLite table name");
        }
    }

    protected async doAdd(ids: string[], texts: string[], embeddings: number[][]): Promise<void> {
        const db = await this.getDb();
        const statement = db.prepare(
            `INSERT OR REPLACE INTO ${this.tableName} (id, content, embedding) VALUES (?, ?, ?)`
        );

        for (let index = 0; index < ids.length; index += 1) {
            statement.run(ids[index], texts[index], JSON.stringify(embeddings[index]));
        }
    }

    protected async doQuery(embedding: number[], topK: number, threshold: number): Promise<string[]> {
        const db = await this.getDb();
        const statement = db.prepare(`SELECT content, embedding FROM ${this.tableName}`);
        const rows = statement.all();

        const scored = rows
            .map((row) => ({
                content: row.content,
                distance: this.cosineDistance(embedding, this.parseEmbedding(row.embedding))
            }))
            .filter((row) => Number.isFinite(row.distance) && row.distance <= threshold)
            .sort((left, right) => left.distance - right.distance)
            .slice(0, topK);

        return scored.map((item) => item.content);
    }

    protected async doReset(): Promise<void> {
        const db = await this.getDb();
        db.exec(`DELETE FROM ${this.tableName}`);
    }

    private async getDb(): Promise<SQLiteDatabase> {
        this.dbPromise ??= this.createDb();
        return this.dbPromise;
    }

    private async createDb(): Promise<SQLiteDatabase> {
        await fs.mkdir(this.storagePath, { recursive: true });
        const dbPath = path.join(this.storagePath, "vectors.db");
        const db = await this.openDb(dbPath);

        if (this.resetOnStart) {
            db.exec(`DROP TABLE IF EXISTS ${this.tableName}`);
        }

        db.exec(
            `CREATE TABLE IF NOT EXISTS ${this.tableName} (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding TEXT NOT NULL
            )`
        );

        return db;
    }

    private async defaultLoader(): Promise<SQLiteModule> {
        const loaded = await import("better-sqlite3");
        return loaded as SQLiteModule;
    }

    private async openDb(dbPath: string): Promise<SQLiteDatabase> {
        try {
            const nodeSqlite = await import("node:sqlite");
            const DatabaseSync = nodeSqlite.DatabaseSync as unknown as new (filePath: string) => SQLiteDatabase;
            return new DatabaseSync(dbPath);
        } catch {
            const module = await this.loader().catch(() => {
                throw new Error(
                    "SQLite vector store requires node:sqlite support or optional dependency better-sqlite3. Install it with: npm i better-sqlite3"
                );
            });

            const BetterSqlite3 = module.default;
            return new BetterSqlite3(dbPath);
        }
    }

    private parseEmbedding(raw: string): number[] {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            throw new Error("Invalid embedding stored in SQLite vector store");
        }

        return parsed.map((value) => {
            if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new Error("Invalid embedding value stored in SQLite vector store");
            }
            return value;
        });
    }

    private cosineDistance(left: number[], right: number[]): number {
        if (left.length !== right.length || left.length === 0) {
            return Number.POSITIVE_INFINITY;
        }

        let dot = 0;
        let leftNormSquared = 0;
        let rightNormSquared = 0;

        for (let index = 0; index < left.length; index += 1) {
            const leftValue = left[index];
            const rightValue = right[index];

            if (leftValue === undefined || rightValue === undefined) {
                return Number.POSITIVE_INFINITY;
            }

            dot += leftValue * rightValue;
            leftNormSquared += leftValue * leftValue;
            rightNormSquared += rightValue * rightValue;
        }

        const leftNorm = Math.sqrt(leftNormSquared);
        const rightNorm = Math.sqrt(rightNormSquared);

        if (leftNorm === 0 || rightNorm === 0) {
            return 1;
        }

        const similarity = dot / (leftNorm * rightNorm);
        return 1 - similarity;
    }
}
