import type { AppConfig } from "../utils/config.js";

export type DbEngine = "postgresql" | "mysql" | "sqlite" | "sqlserver";

export type QueryRow = Record<string, unknown>;

export interface QueryExecutionResult {
    rows: QueryRow[];
    columns: string[];
}

export interface RawConnection {
    readonly engine: DbEngine;
    query(sql: string, params?: unknown[]): Promise<QueryExecutionResult>;
    execute(sql: string, params?: unknown[]): Promise<void>;
    close(): Promise<void>;
}

type UnknownModule = Record<string, unknown>;

const dynamicImport = new Function("modulePath", "return import(modulePath)") as (
    modulePath: string
) => Promise<UnknownModule>;

async function loadOptionalModule(modulePath: string): Promise<UnknownModule | null> {
    try {
        return await dynamicImport(modulePath);
    } catch {
        return null;
    }
}

function parseEngine(dbType: string): DbEngine {
    const normalized = dbType.trim().toLowerCase();

    if (normalized === "postgresql" || normalized === "mysql" || normalized === "sqlite" || normalized === "sqlserver") {
        return normalized;
    }

    throw new Error(`Unsupported dbType: ${dbType}`);
}

function parseSqlitePath(dbUrl: string | null): string {
    if (!dbUrl) {
        return ":memory:";
    }

    if (dbUrl === "sqlite:///:memory:" || dbUrl === "sqlite::memory:") {
        return ":memory:";
    }

    if (!dbUrl.startsWith("sqlite:///")) {
        throw new Error("sqlite dbUrl must start with sqlite:///");
    }

    const path = dbUrl.slice("sqlite:///".length);
    return path.length > 0 ? decodeURIComponent(path) : ":memory:";
}

function normalizeParams(params?: unknown[]): unknown[] {
    return params ?? [];
}

class SQLiteConnection implements RawConnection {
    readonly engine: DbEngine = "sqlite";
    private readonly db: {
        prepare(sql: string): {
            columns?: () => Array<{ name: string }>;
            all(...params: unknown[]): QueryRow[];
            run(...params: unknown[]): unknown;
        };
        close(): void;
    };

    constructor(db: SQLiteConnection["db"]) {
        this.db = db;
    }

    async query(sql: string, params?: unknown[]): Promise<QueryExecutionResult> {
        const statement = this.db.prepare(sql);
        const rows = statement.all(...normalizeParams(params));

        let columns: string[] = [];
        if (typeof statement.columns === "function") {
            columns = statement.columns().map((column) => column.name);
        } else {
            const firstRow = rows[0];
            if (firstRow) {
                columns = Object.keys(firstRow);
            }
        }

        return { rows, columns };
    }

    async execute(sql: string, params?: unknown[]): Promise<void> {
        const statement = this.db.prepare(sql);
        statement.run(...normalizeParams(params));
    }

    async close(): Promise<void> {
        this.db.close();
    }
}

class PgConnection implements RawConnection {
    readonly engine: DbEngine = "postgresql";

    constructor(private readonly client: {
        query(sql: string, params?: unknown[]): Promise<{ rows: QueryRow[]; fields?: Array<{ name: string }> }>;
        end(): Promise<void>;
    }) { }

    async query(sql: string, params?: unknown[]): Promise<QueryExecutionResult> {
        const result = await this.client.query(sql, normalizeParams(params));
        return {
            rows: result.rows,
            columns: result.fields?.map((field) => field.name) ?? (result.rows[0] ? Object.keys(result.rows[0]) : [])
        };
    }

    async execute(sql: string, params?: unknown[]): Promise<void> {
        await this.client.query(sql, normalizeParams(params));
    }

    async close(): Promise<void> {
        await this.client.end();
    }
}

class MySqlConnection implements RawConnection {
    readonly engine: DbEngine = "mysql";

    constructor(private readonly conn: {
        query(sql: string, params?: unknown[]): Promise<[QueryRow[], Array<{ name: string }> | undefined]>;
        end(): Promise<void>;
    }) { }

    async query(sql: string, params?: unknown[]): Promise<QueryExecutionResult> {
        const [rows, fields] = await this.conn.query(sql, normalizeParams(params));
        return {
            rows,
            columns: fields?.map((field) => field.name) ?? (rows[0] ? Object.keys(rows[0]) : [])
        };
    }

    async execute(sql: string, params?: unknown[]): Promise<void> {
        await this.conn.query(sql, normalizeParams(params));
    }

    async close(): Promise<void> {
        await this.conn.end();
    }
}

class SqlServerConnection implements RawConnection {
    readonly engine: DbEngine = "sqlserver";

    constructor(private readonly pool: {
        request(): { query(sql: string): Promise<{ recordset: QueryRow[]; columns?: Record<string, unknown> }> };
        close(): Promise<void>;
    }) { }

    async query(sql: string): Promise<QueryExecutionResult> {
        const result = await this.pool.request().query(sql);
        const columns = result.recordset[0]
            ? Object.keys(result.recordset[0])
            : Object.keys(result.columns ?? {});
        return { rows: result.recordset, columns };
    }

    async execute(sql: string): Promise<void> {
        await this.pool.request().query(sql);
    }

    async close(): Promise<void> {
        await this.pool.close();
    }
}

export class Connection {
    private readonly config: AppConfig;

    constructor(config: AppConfig) {
        this.config = config;
    }

    async connect(): Promise<RawConnection> {
        const engine = parseEngine(this.config.dbType);

        if (engine === "sqlite") {
            const sqlitePath = parseSqlitePath(this.config.dbUrl);

            try {
                const sqliteModule = await import("node:sqlite");
                const db = new sqliteModule.DatabaseSync(sqlitePath);
                return new SQLiteConnection(db);
            } catch {
                try {
                    const betterSqlite3Module = await import("better-sqlite3");
                    const BetterSqlite3 = betterSqlite3Module.default as new (path: string) => SQLiteConnection["db"];
                    const db = new BetterSqlite3(sqlitePath);
                    return new SQLiteConnection(db);
                } catch {
                    throw new Error(
                        "SQLite backend requires Node.js with node:sqlite support or optional dependency better-sqlite3"
                    );
                }
            }
        }

        if (!this.config.dbUrl) {
            throw new Error("dbUrl is required for non-sqlite engines");
        }

        if (engine === "postgresql") {
            const pgModule = await loadOptionalModule("pg");
            if (!pgModule || typeof pgModule.Client !== "function") {
                throw new Error("PostgreSQL support requires optional dependency pg");
            }

            const PgClient = pgModule.Client as new (config: { connectionString: string }) => {
                connect(): Promise<void>;
                query(sql: string, params?: unknown[]): Promise<{ rows: QueryRow[]; fields?: Array<{ name: string }> }>;
                end(): Promise<void>;
            };

            const client = new PgClient({ connectionString: this.config.dbUrl });
            await client.connect();
            return new PgConnection(client);
        }

        if (engine === "mysql") {
            const mysqlModule = await loadOptionalModule("mysql2/promise");
            if (!mysqlModule || typeof mysqlModule.createConnection !== "function") {
                throw new Error("MySQL support requires optional dependency mysql2");
            }

            const createConnection = mysqlModule.createConnection as (url: string) => Promise<{
                query(sql: string, params?: unknown[]): Promise<[QueryRow[], Array<{ name: string }> | undefined]>;
                end(): Promise<void>;
            }>;

            const conn = await createConnection(this.config.dbUrl);
            return new MySqlConnection(conn);
        }

        const mssqlModule = await loadOptionalModule("mssql");
        if (!mssqlModule || typeof mssqlModule.connect !== "function") {
            throw new Error("SQL Server support requires optional dependency mssql");
        }

        const connect = mssqlModule.connect as (url: string) => Promise<{
            request(): { query(sql: string): Promise<{ recordset: QueryRow[]; columns?: Record<string, unknown> }> };
            close(): Promise<void>;
        }>;

        const pool = await connect(this.config.dbUrl);
        return new SqlServerConnection(pool);
    }
}
