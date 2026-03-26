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

    async runSelect(_query: string): Promise<QueryResult> {
        void this.connection;
        return null;
    }
}
