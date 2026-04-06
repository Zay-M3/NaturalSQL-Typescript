import { describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import Database from "better-sqlite3";

import { NaturalSQL } from "../src/api.js";
import { EmbeddingProvider } from "../src/vector/providers/base.js";
import { LocalTransformersProvider } from "../src/vector/providers/local.js";
import { VectorStore } from "../src/vector/stores/base.js";

class FakeProvider extends EmbeddingProvider {
    protected async doEmbedDocuments(documents: string[]): Promise<number[][]> {
        return documents.map((doc) => (doc.includes("users") ? [1, 0] : [0, 1]));
    }

    protected async doEmbedQuery(query: string): Promise<number[]> {
        return query.includes("users") ? [1, 0] : [0, 1];
    }
}

class MemoryStore extends VectorStore {
    private docs: Array<{ text: string; embedding: number[] }> = [];

    protected async doAdd(_ids: string[], texts: string[], embeddings: number[][]): Promise<void> {
        this.docs = texts.map((text, idx) => ({ text, embedding: embeddings[idx] }));
    }

    protected async doQuery(embedding: number[], topK: number, threshold: number): Promise<string[]> {
        const scored = this.docs
            .map((item) => ({
                text: item.text,
                distance: this.distance(embedding, item.embedding)
            }))
            .filter((item) => item.distance <= threshold)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, topK);

        return scored.map((item) => item.text);
    }

    protected async doReset(): Promise<void> {
        this.docs = [];
    }

    private distance(left: number[], right: number[]): number {
        let dot = 0;
        let lNorm = 0;
        let rNorm = 0;

        for (let i = 0; i < left.length; i += 1) {
            dot += left[i] * right[i];
            lNorm += left[i] * left[i];
            rNorm += right[i] * right[i];
        }

        const denom = Math.sqrt(lNorm) * Math.sqrt(rNorm);
        if (!denom) {
            return 1;
        }

        return 1 - dot / denom;
    }
}

describe("NaturalSQL API", () => {
    it("valida reglas de geminiApiKey", () => {
        expect(() => new NaturalSQL({ embeddingProvider: "gemini" })).toThrow(
            "geminiApiKey is required when embeddingProvider='gemini'"
        );

        expect(() => new NaturalSQL({ embeddingProvider: "local", geminiApiKey: "key" })).toThrow(
            "geminiApiKey should only be provided when embeddingProvider='gemini'"
        );
    });

    it("buildVectorDb indexa esquema y reutiliza cache", async () => {
        const sourcePath = ".tmp-tests/api/source.db";
        const vectorPath = ".tmp-tests/api/vector-cache";

        await fs.rm(".tmp-tests/api", { recursive: true, force: true });
        await fs.mkdir(".tmp-tests/api", { recursive: true });

        const sourceDb = new Database(sourcePath);
        sourceDb.exec("CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT);");
        sourceDb.exec("CREATE TABLE orders(id INTEGER PRIMARY KEY, user_id INTEGER);");
        sourceDb.close();

        const sharedStore = new MemoryStore();

        const nsql = new NaturalSQL({
            dbType: "sqlite",
            dbUrl: `sqlite:///${sourcePath}`,
            embeddingProvider: "local",
            vectorBackend: "sqlite",
            vectorDistanceThreshold: 0.4
        });

        const deps = {
            createEmbeddingProvider: async () => new FakeProvider(),
            createVectorStore: async (_config: unknown, _path: string, reset: boolean) => {
                if (reset) {
                    await sharedStore.reset();
                }
                return sharedStore;
            }
        };

        const first = await nsql.buildVectorDb(vectorPath, { dependencies: deps });
        expect(first.fromCache).toBe(false);
        expect(first.indexedTables).toBe(2);

        const second = await nsql.buildVectorDb(vectorPath, { dependencies: deps });
        expect(second.fromCache).toBe(true);
        expect(second.indexedTables).toBe(2);

        const found = await nsql.search("show users", {
            storagePath: vectorPath,
            limit: 2,
            dependencies: deps
        });

        expect(found.length).toBeGreaterThan(0);
        expect(found[0]).toContain("users");
    });

    it("buildVectorDb y search funcionan con local provider parseando Tensor TypedArray", async () => {
        const sourcePath = ".tmp-tests/api/source-local-tensor.db";
        const vectorPath = ".tmp-tests/api/vector-local-tensor";

        await fs.rm(".tmp-tests/api", { recursive: true, force: true });
        await fs.mkdir(".tmp-tests/api", { recursive: true });

        const sourceDb = new Database(sourcePath);
        sourceDb.exec("CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT);");
        sourceDb.exec("CREATE TABLE orders(id INTEGER PRIMARY KEY, user_id INTEGER);");
        sourceDb.close();

        const sharedStore = new MemoryStore();

        const nsql = new NaturalSQL({
            dbType: "sqlite",
            dbUrl: `sqlite:///${sourcePath}`,
            embeddingProvider: "local",
            vectorBackend: "sqlite",
            vectorDistanceThreshold: 0.4
        });

        const deps = {
            createEmbeddingProvider: async () => new LocalTransformersProvider({
                loader: async () => ({
                    pipeline: async () => async (input) => {
                        if (Array.isArray(input)) {
                            const values = input.flatMap((doc) => {
                                const isUsers = doc.includes("users");
                                return isUsers ? [1, 0] : [0, 1];
                            });

                            return {
                                dims: [input.length, 2],
                                data: new Float32Array(values)
                            };
                        }

                        const queryVector = input.includes("users") ? [1, 0] : [0, 1];
                        return {
                            dims: [2],
                            data: new Float32Array(queryVector)
                        };
                    }
                })
            }),
            createVectorStore: async (_config: unknown, _path: string, reset: boolean) => {
                if (reset) {
                    await sharedStore.reset();
                }
                return sharedStore;
            }
        };

        const built = await nsql.buildVectorDb(vectorPath, { dependencies: deps });
        expect(built.fromCache).toBe(false);
        expect(built.indexedTables).toBe(2);

        const found = await nsql.search("show users", {
            storagePath: vectorPath,
            limit: 2,
            dependencies: deps
        });

        expect(found.length).toBeGreaterThan(0);
        expect(found[0]).toContain("users");
    });
});
