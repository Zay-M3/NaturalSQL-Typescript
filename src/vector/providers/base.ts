export abstract class EmbeddingProvider {
    async embedDocuments(documents: string[]): Promise<number[][]> {
        if (!Array.isArray(documents) || documents.length === 0) {
            throw new Error("documents must be a non-empty string array");
        }

        if (documents.some((value) => typeof value !== "string" || value.trim() === "")) {
            throw new Error("each document must be a non-empty string");
        }

        const embeddings = await this.doEmbedDocuments(documents);

        if (!Array.isArray(embeddings) || embeddings.length !== documents.length) {
            throw new Error("embedding count must match documents count");
        }

        for (const embedding of embeddings) {
            this.assertEmbeddingVector(embedding);
        }

        return embeddings;
    }

    async embedQuery(query: string): Promise<number[]> {
        if (typeof query !== "string" || query.trim() === "") {
            throw new Error("query must be a non-empty string");
        }

        const embedding = await this.doEmbedQuery(query);
        this.assertEmbeddingVector(embedding);
        return embedding;
    }

    protected abstract doEmbedDocuments(documents: string[]): Promise<number[][]>;
    protected abstract doEmbedQuery(query: string): Promise<number[]>;

    private assertEmbeddingVector(embedding: number[]): void {
        if (!Array.isArray(embedding) || embedding.length === 0) {
            throw new Error("embedding vector must be a non-empty number array");
        }

        if (embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
            throw new Error("embedding vector must contain finite numbers");
        }
    }
}
