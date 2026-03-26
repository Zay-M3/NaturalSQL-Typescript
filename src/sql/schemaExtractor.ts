import { IGNORE_TABLE } from "../utils/constants.js";
import type { RawConnection } from "./connection.js";

export type SchemaMap = Record<string, Array<[string, string]>>;

export class SQLSchemaExtractor {
    private readonly connection: RawConnection;

    constructor(connection: RawConnection) {
        this.connection = connection;
    }

    async extractSchema(): Promise<SchemaMap> {
        void this.connection;
        void IGNORE_TABLE;
        return {};
    }

    formatForAI(_schema: SchemaMap): string[] {
        return [];
    }
}
