import { describe, expect, it } from "vitest";

import type { RawConnection } from "../../src/sql/connection.js";
import { Connection } from "../../src/sql/connection.js";
import { SQLSchemaExtractor } from "../../src/sql/schemaExtractor.js";
import { createConfig } from "../../src/utils/config.js";

describe("SQLSchemaExtractor", () => {
    it("extrae esquema real desde SQLite e ignora tablas configuradas", async () => {
        const config = createConfig({
            dbType: "sqlite",
            dbUrl: "sqlite:///:memory:"
        });

        const conn = await new Connection(config).connect();
        await conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
        await conn.execute("CREATE TABLE vector_store (id INTEGER PRIMARY KEY, embedding TEXT)");

        const extractor = new SQLSchemaExtractor(conn);
        const schema = await extractor.extractSchema();

        expect(schema.users).toBeDefined();
        expect(schema.users.map(([name]) => name)).toEqual(["id", "name"]);
        expect(schema.vector_store).toBeUndefined();

        const docs = extractor.formatForAI(schema);
        expect(docs[0]).toContain("Table name: users");

        await conn.close();
    });

    it("parsea information_schema para motores no sqlite usando mock", async () => {
        const mockConnection: RawConnection = {
            engine: "postgresql",
            async query() {
                return {
                    columns: ["table_name", "column_name", "data_type"],
                    rows: [
                        { table_name: "users", column_name: "id", data_type: "integer" },
                        { table_name: "users", column_name: "email", data_type: "text" },
                        { table_name: "vector_store", column_name: "embedding", data_type: "text" }
                    ]
                };
            },
            async execute() {
                return;
            },
            async close() {
                return;
            }
        };

        const extractor = new SQLSchemaExtractor(mockConnection);
        const schema = await extractor.extractSchema();

        expect(schema.users).toEqual([
            ["id", "integer"],
            ["email", "text"]
        ]);
        expect(schema.vector_store).toBeUndefined();
    });
});
