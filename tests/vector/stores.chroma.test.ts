import { describe, expect, it } from "vitest";

import { ChromaVectorStore } from "../../src/vector/stores/chromaStore.js";

describe("ChromaVectorStore", () => {
    it("upsert/query/reset con cliente mockeado y filtro por threshold", async () => {
        const state = {
            upserts: 0,
            deleted: 0
        };

        const fakeCollection = {
            async upsert() {
                state.upserts += 1;
            },
            async query() {
                return {
                    documents: [["users", "orders", "products"]],
                    distances: [[0.01, 0.2, 0.9]]
                };
            }
        };

        const fakeClient = {
            async getOrCreateCollection() {
                return fakeCollection;
            },
            async deleteCollection() {
                state.deleted += 1;
            }
        };

        const store = new ChromaVectorStore({
            storagePath: ".tmp-tests/chroma-vector-store",
            collectionName: "test_collection",
            resetOnStart: false,
            loader: async () => ({
                ChromaClient: class {
                    constructor() {
                        return fakeClient;
                    }
                }
            })
        });

        await store.add(["a"], ["users"], [[1, 0]]);
        expect(state.upserts).toBe(1);

        const strict = await store.query([1, 0], 3, 0.25);
        expect(strict).toEqual(["users", "orders"]);

        await store.reset();
        expect(state.deleted).toBe(1);
    });

    it("muestra mensaje accionable cuando falta chromadb", async () => {
        const store = new ChromaVectorStore({
            storagePath: ".tmp-tests/chroma-vector-store",
            loader: async () => {
                throw new Error("module not found");
            }
        });

        await expect(store.query([1, 0], 1, 1)).rejects.toThrow(
            "Chroma vector store requires optional dependency chromadb"
        );
    });
});
