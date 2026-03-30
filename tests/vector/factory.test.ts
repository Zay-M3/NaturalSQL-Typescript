import { describe, expect, it, vi } from "vitest";

import { createConfig } from "../../src/utils/config.js";
import { createEmbeddingProvider, createVectorStore } from "../../src/vector/factory.js";
import { GeminiEmbeddingProvider } from "../../src/vector/providers/gemini.js";
import { LocalTransformersProvider } from "../../src/vector/providers/local.js";
import { ChromaVectorStore } from "../../src/vector/stores/chromaStore.js";
import { SQLiteVectorStore } from "../../src/vector/stores/sqliteStore.js";

describe("vector factory", () => {
    it("enruta embedding provider local y gemini", async () => {
        const localConfig = createConfig({ embeddingProvider: "local" });
        const geminiConfig = createConfig({ embeddingProvider: "gemini", geminiApiKey: "test-key" });

        await expect(createEmbeddingProvider(localConfig)).resolves.toBeInstanceOf(LocalTransformersProvider);
        await expect(createEmbeddingProvider(geminiConfig)).resolves.toBeInstanceOf(GeminiEmbeddingProvider);
    });

    it("enruta vector stores por backend", async () => {
        const sqliteConfig = createConfig({ vectorBackend: "sqlite" });
        const chromaConfig = createConfig({ vectorBackend: "chroma" });

        await expect(createVectorStore(sqliteConfig, "tmp/sqlite", false)).resolves.toBeInstanceOf(SQLiteVectorStore);
        await expect(createVectorStore(chromaConfig, "tmp/chroma", false)).resolves.toBeInstanceOf(ChromaVectorStore);
    });

    it("aplica reset al crear store cuando se solicita", async () => {
        const config = createConfig({ vectorBackend: "sqlite" });
        const resetSpy = vi.spyOn(SQLiteVectorStore.prototype, "reset");

        await createVectorStore(config, "tmp/sqlite", true);

        expect(resetSpy).toHaveBeenCalledTimes(1);
        resetSpy.mockRestore();
    });
});
