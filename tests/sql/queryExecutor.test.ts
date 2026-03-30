import { describe, expect, it } from "vitest";

import { Connection } from "../../src/sql/connection.js";
import { QueryExecutor } from "../../src/sql/queryExecutor.js";
import { createConfig } from "../../src/utils/config.js";

describe("QueryExecutor", () => {
    it("ejecuta SELECT y retorna columnas y filas", async () => {
        const config = createConfig({
            dbType: "sqlite",
            dbUrl: "sqlite:///:memory:"
        });

        const conn = await new Connection(config).connect();
        await conn.execute("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT)");
        await conn.execute("INSERT INTO products (name) VALUES (?)", ["Keyboard"]);

        const executor = new QueryExecutor(conn);
        const result = await executor.runSelect("```sql\nSELECT id, name FROM products ORDER BY id;\n```");

        expect(result).not.toBeNull();
        expect(result?.columns).toEqual(["id", "name"]);
        expect(result?.rows).toEqual([[1, "Keyboard"]]);

        await conn.close();
    });

    it("rechaza multiples sentencias", async () => {
        const config = createConfig({ dbType: "sqlite", dbUrl: "sqlite:///:memory:" });
        const conn = await new Connection(config).connect();

        const executor = new QueryExecutor(conn);
        await expect(executor.runSelect("SELECT 1; SELECT 2;")).rejects.toThrow(
            "Multiple SQL statements are not allowed."
        );

        await conn.close();
    });

    it("rechaza sentencias no SELECT", async () => {
        const config = createConfig({ dbType: "sqlite", dbUrl: "sqlite:///:memory:" });
        const conn = await new Connection(config).connect();

        const executor = new QueryExecutor(conn);
        await expect(executor.runSelect("UPDATE users SET name = 'x' WHERE id = 1")).rejects.toThrow(
            "Only read-only SELECT queries are allowed."
        );

        await conn.close();
    });
});
