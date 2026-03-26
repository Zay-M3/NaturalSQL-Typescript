import type { AppConfig } from "../utils/config.js";
import type { EmbeddingProvider } from "./providers/base.js";
import type { VectorStore } from "./stores/base.js";
import { LocalTransformersProvider } from "./providers/local.js";
import { GeminiEmbeddingProvider } from "./providers/gemini.js";
import { ChromaVectorStore } from "./stores/chromaStore.js";
import { SQLiteVectorStore } from "./stores/sqliteStore.js";

export async function createEmbeddingProvider(config: AppConfig): Promise<EmbeddingProvider> {
    if (config.embeddingProvider === "local") {
        return new LocalTransformersProvider();
    }

    if (config.embeddingProvider === "gemini") {
        return new GeminiEmbeddingProvider();
    }

    throw new Error(`Unknown embedding provider: ${String(config.embeddingProvider)}`);
}

export async function createVectorStore(
    config: AppConfig,
    _storagePath: string,
    _reset = false
): Promise<VectorStore> {
    if (config.vectorBackend === "chroma") {
        return new ChromaVectorStore();
    }

    if (config.vectorBackend === "sqlite") {
        return new SQLiteVectorStore();
    }

    throw new Error(`Unknown vector backend: ${String(config.vectorBackend)}`);
}
