import type { AppConfig } from "../utils/config.js";
import type { EmbeddingProvider } from "./providers/base.js";
import type { VectorStore } from "./stores/base.js";
import { LocalTransformersProvider } from "./providers/local.js";
import { GeminiEmbeddingProvider } from "./providers/gemini.js";
import { ChromaVectorStore } from "./stores/chromaStore.js";
import { SQLiteVectorStore } from "./stores/sqliteStore.js";

export async function createEmbeddingProvider(config: AppConfig): Promise<EmbeddingProvider> {
    if (config.embeddingProvider === "local") {
        return new LocalTransformersProvider({
            device: config.device,
            normalizeEmbeddings: config.normalizeEmbeddings
        });
    }

    if (config.embeddingProvider === "gemini") {
        return new GeminiEmbeddingProvider({
            apiKey: config.geminiApiKey,
            model: config.geminiEmbeddingModel
        });
    }

    throw new Error(`Unknown embedding provider: ${String(config.embeddingProvider)}`);
}

export async function createVectorStore(
    config: AppConfig,
    _storagePath: string,
    _reset = false
): Promise<VectorStore> {
    let store: VectorStore;

    if (config.vectorBackend === "chroma") {
        store = new ChromaVectorStore();
    } else if (config.vectorBackend === "sqlite") {
        store = new SQLiteVectorStore();
    } else {
        throw new Error(`Unknown vector backend: ${String(config.vectorBackend)}`);
    }

    if (_reset) {
        await store.reset();
    }

    return store;
}
