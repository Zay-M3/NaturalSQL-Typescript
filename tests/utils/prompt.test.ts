import { describe, expect, it } from "vitest";

import { buildPrompt } from "../../src/utils/prompt.js";

describe("buildPrompt", () => {
    it("incluye esquema y pregunta del usuario", () => {
        const prompt = buildPrompt(
            [
                "Table: users\n- id (INTEGER)\n- name (TEXT)",
                "Table: orders\n- id (INTEGER)\n- user_id (INTEGER)"
            ],
            "Show all users with their orders"
        );

        expect(prompt).toContain("### Schema:");
        expect(prompt).toContain("Table: users");
        expect(prompt).toContain("Table: orders");
        expect(prompt).toContain("### Question:");
        expect(prompt).toContain("Show all users with their orders");
        expect(prompt).toContain("### SQL Query:");
    });

    it("mantiene formato valido cuando no hay tablas", () => {
        const prompt = buildPrompt([], "List all products");

        expect(prompt).toContain("### Schema:");
        expect(prompt).toContain("### Question:");
        expect(prompt).toContain("List all products");
        expect(prompt.endsWith("### SQL Query:")).toBe(true);
    });
});
