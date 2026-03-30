import type { RawConnection } from "./connection.js";

export type QueryResult = {
    columns: string[];
    rows: unknown[][];
} | null;

export class QueryExecutor {
    private readonly connection: RawConnection;

    constructor(connection: RawConnection) {
        this.connection = connection;
    }

    async runSelect(query: string): Promise<QueryResult> {
        const cleanedSql = this.cleanSql(query);
        const sql = cleanedSql.trim().replace(/;\s*$/, "");

        if (sql.includes(";")) {
            throw new Error("Multiple SQL statements are not allowed.");
        }

        if (!/^\s*select\b/is.test(sql)) {
            throw new Error("Only read-only SELECT queries are allowed.");
        }

        const result = await this.connection.query(sql);
        return {
            columns: result.columns,
            rows: result.rows.map((row) => result.columns.map((column) => row[column]))
        };
    }

    private cleanSql(rawQuery: string): string {
        return rawQuery.replace(/```sql|```/gi, "").trim();
    }
}
