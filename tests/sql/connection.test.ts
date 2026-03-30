import { describe, expect, it } from "vitest";

import { Connection } from "../../src/sql/connection.js";
import { createConfig } from "../../src/utils/config.js";

describe("Connection", () => {
    it("conecta a SQLite en memoria y ejecuta queries", async () => {
        const config = createConfig({
            dbType: "sqlite",
            dbUrl: "sqlite:///:memory:"
        });

        const conn = await new Connection(config).connect();

        await conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
        await conn.execute("INSERT INTO users (name) VALUES (?)", ["Ada"]);

        const result = await conn.query("SELECT id, name FROM users ORDER BY id");

        expect(result.columns).toEqual(["id", "name"]);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].name).toBe("Ada");

        await conn.close();
    });

    it("falla en motores no sqlite cuando dbUrl no existe", async () => {
        const config = createConfig({
            dbType: "postgresql",
            dbUrl: null
        });

        await expect(new Connection(config).connect()).rejects.toThrow("dbUrl is required for non-sqlite engines");
    });

    it("falla cuando dbType no es soportado", async () => {
        const config = createConfig({
            dbType: "oracle"
        });

        await expect(new Connection(config).connect()).rejects.toThrow("Unsupported dbType");
    });
});
