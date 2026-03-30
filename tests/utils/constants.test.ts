import { describe, expect, it } from "vitest";

import { CONNECTION_TEMPLATES, IGNORE_TABLE, IGNORE_TABLES } from "../../src/utils/constants.js";

describe("constants", () => {
    it("expone templates de conexion para motores soportados", () => {
        expect(CONNECTION_TEMPLATES.postgresql).toContain("postgresql://");
        expect(CONNECTION_TEMPLATES.mysql).toContain("mysql://");
        expect(CONNECTION_TEMPLATES.sqlite).toContain("sqlite:///");
        expect(CONNECTION_TEMPLATES.sqlserver).toContain("mssql://");
    });

    it("incluye tablas a ignorar de migraciones y vector stores", () => {
        expect(IGNORE_TABLE.has("alembic_version")).toBe(true);
        expect(IGNORE_TABLE.has("langchain_pg_embedding")).toBe(true);
        expect(IGNORE_TABLE.has("embeddings")).toBe(true);
        expect(IGNORE_TABLE.has("sqlite_sequence")).toBe(true);
    });

    it("mantiene alias de compatibilidad", () => {
        expect(IGNORE_TABLES).toBe(IGNORE_TABLE);
    });
});
