import { describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";

import { createConfig } from "../../src/utils/config.js";
import { VectorManager } from "../../src/controller/vectorManager.js";
import { EmbeddingProvider } from "../../src/vector/providers/base.js";
import { VectorStore } from "../../src/vector/stores/base.js";

class FakeProvider extends EmbeddingProvider {
    protected async doEmbedDocuments(documents: string[]): Promise<number[][]> {
        return documents.map(() => [1, 0]);
    }

    protected async doEmbedQuery(): Promise<number[]> {
        return [1, 0];
    }
}

class FakeStore extends VectorStore {
    public addCalls = 0;
    public queryCalls = 0;
    public resetCalls = 0;

    protected async doAdd(): Promise<void> {
        this.addCalls += 1;
    }

    protected async doQuery(): Promise<string[]> {
        this.queryCalls += 1;
        return ["users", "orders"];
    }

    protected async doReset(): Promise<void> {
        this.resetCalls += 1;
    }
}

describe("VectorManager e2e interno", () => {
    it("construye cache metadata y reutiliza indice cuando coincide cacheKey", async () => {
        const storagePath = ".tmp-tests/vector-manager-cache";
        await fs.rm(storagePath, { recursive: true, force: true });

        const config = createConfig({ vectorBackend: "sqlite", embeddingProvider: "local" });
        const firstStore = new FakeStore();

        const manager1 = await VectorManager.create(config, storagePath, {
            cacheKey: "schema-v1",
            dependencies: {
                createEmbeddingProvider: async () => new FakeProvider(),
                createVectorStore: async (_config, _storagePath, reset) => {
                    if (reset) {
                        await firstStore.reset();
                    }
                    return firstStore;
                }
            }
        });

        expect(manager1.isFromCache()).toBe(false);
        expect(firstStore.resetCalls).toBe(1);

        await manager1.upsert(["Table users(id,name)", "Table orders(id,user_id)"]);
        expect(manager1.getIndexedTablesCount()).toBe(2);

        const secondStore = new FakeStore();
        const manager2 = await VectorManager.create(config, storagePath, {
            cacheKey: "schema-v1",
            dependencies: {
                createEmbeddingProvider: async () => new FakeProvider(),
                createVectorStore: async (_config, _storagePath, reset) => {
                    if (reset) {
                        await secondStore.reset();
                    }
                    return secondStore;
                }
            }
        });

        expect(manager2.isFromCache()).toBe(true);
        expect(secondStore.resetCalls).toBe(0);
    });

    it("reconstruye cuando cambia cacheKey o se usa forceReset", async () => {
        const storagePath = ".tmp-tests/vector-manager-rebuild";
        await fs.rm(storagePath, { recursive: true, force: true });

        const config = createConfig({ vectorBackend: "sqlite", embeddingProvider: "local" });
        const seedStore = new FakeStore();

        const seedManager = await VectorManager.create(config, storagePath, {
            cacheKey: "schema-v1",
            dependencies: {
                createEmbeddingProvider: async () => new FakeProvider(),
                createVectorStore: async (_config, _storagePath, reset) => {
                    if (reset) {
                        await seedStore.reset();
                    }
                    return seedStore;
                }
            }
        });

        await seedManager.upsert(["Table users(id,name)"]);

        const changedKeyStore = new FakeStore();
        const managerChangedKey = await VectorManager.create(config, storagePath, {
            cacheKey: "schema-v2",
            dependencies: {
                createEmbeddingProvider: async () => new FakeProvider(),
                createVectorStore: async (_config, _storagePath, reset) => {
                    if (reset) {
                        await changedKeyStore.reset();
                    }
                    return changedKeyStore;
                }
            }
        });

        expect(managerChangedKey.isFromCache()).toBe(false);
        expect(changedKeyStore.resetCalls).toBe(1);

        const forceResetStore = new FakeStore();
        const managerForce = await VectorManager.create(config, storagePath, {
            cacheKey: "schema-v2",
            forceReset: true,
            dependencies: {
                createEmbeddingProvider: async () => new FakeProvider(),
                createVectorStore: async (_config, _storagePath, reset) => {
                    if (reset) {
                        await forceResetStore.reset();
                    }
                    return forceResetStore;
                }
            }
        });

        expect(managerForce.isFromCache()).toBe(false);
        expect(forceResetStore.resetCalls).toBe(1);
    });

    it("search usa provider + store", async () => {
        const storagePath = ".tmp-tests/vector-manager-search";
        await fs.rm(storagePath, { recursive: true, force: true });

        const config = createConfig({ vectorBackend: "sqlite", embeddingProvider: "local" });
        const store = new FakeStore();

        const manager = await VectorManager.create(config, storagePath, {
            dependencies: {
                createEmbeddingProvider: async () => new FakeProvider(),
                createVectorStore: async () => store
            }
        });

        const result = await manager.search("find users", 3, 0.5);
        expect(result).toEqual(["users", "orders"]);
        expect(store.queryCalls).toBe(1);
    });
});
