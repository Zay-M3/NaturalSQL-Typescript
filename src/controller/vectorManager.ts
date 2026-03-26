import type { AppConfig } from "../utils/config.js";
import type { EmbeddingProvider } from "../vector/providers/base.js";
import type { VectorStore } from "../vector/stores/base.js";
import { createEmbeddingProvider, createVectorStore } from "../vector/factory.js";

export class VectorManager {
    private constructor(
        private readonly provider: EmbeddingProvider,
        private readonly store: VectorStore
    ) { }

    static async create(config: AppConfig, storagePath: string): Promise<VectorManager> {
        const provider = await createEmbeddingProvider(config);
        const store = await createVectorStore(config, storagePath, false);
        return new VectorManager(provider, store);
    }

    async upsert(documents: string[]): Promise<void> {
        const ids = documents.map((_, index) => `doc-${index}`);
        const embeddings = await this.provider.embedDocuments(documents);
        await this.store.add(ids, documents, embeddings);
    }

    async search(question: string, topK: number, threshold: number): Promise<string[]> {
        const queryEmbedding = await this.provider.embedQuery(question);
        return this.store.query(queryEmbedding, topK, threshold);
    }
}
