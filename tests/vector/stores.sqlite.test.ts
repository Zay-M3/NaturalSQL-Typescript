import { describe, expect, it } from "vitest";

import { SQLiteVectorStore } from "../../src/vector/stores/sqliteStore.js";

describe("SQLiteVectorStore", () => {
    it("agrega, consulta por similitud y aplica threshold", async () => {
        const store = new SQLiteVectorStore({
            storagePath: ".tmp-tests/sqlite-vector-store-1",
            tableName: "vectors_test",
            resetOnStart: true
        });

        await store.add(
            ["a", "b", "c"],
            ["users", "orders", "products"],
            [
                [1, 0],
                [0.9, 0.1],
                [0, 1]
            ]
        );

        const wide = await store.query([1, 0], 3, 1);
        expect(wide).toEqual(["users", "orders", "products"]);

        const strict = await store.query([1, 0], 3, 0.02);
        expect(strict).toEqual(["users", "orders"]);
    });

    it("reset elimina datos", async () => {
        const store = new SQLiteVectorStore({
            storagePath: ".tmp-tests/sqlite-vector-store-2",
            tableName: "vectors_test",
            resetOnStart: true
        });

        await store.add(["a"], ["users"], [[1, 0]]);
        expect(await store.query([1, 0], 1, 1)).toEqual(["users"]);

        await store.reset();
        expect(await store.query([1, 5], 5, 1)).toEqual([]);
    });
});
