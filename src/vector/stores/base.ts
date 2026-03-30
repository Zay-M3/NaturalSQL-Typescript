export abstract class VectorStore {
    async add(ids: string[], texts: string[], embeddings: number[][]): Promise<void> {
        if (!Array.isArray(ids) || !Array.isArray(texts) || !Array.isArray(embeddings)) {
            throw new Error("ids, texts and embeddings must be arrays");
        }

        if (ids.length === 0 || texts.length === 0 || embeddings.length === 0) {
            throw new Error("ids, texts and embeddings cannot be empty");
        }

        if (ids.length !== texts.length || ids.length !== embeddings.length) {
            throw new Error("ids, texts and embeddings must have the same length");
        }

        if (ids.some((id) => typeof id !== "string" || id.trim() === "")) {
            throw new Error("each id must be a non-empty string");
        }

        if (texts.some((text) => typeof text !== "string" || text.trim() === "")) {
            throw new Error("each text must be a non-empty string");
        }

        for (const embedding of embeddings) {
            this.assertEmbeddingVector(embedding);
        }

        await this.doAdd(ids, texts, embeddings);
    }

    async query(embedding: number[], topK: number, threshold: number): Promise<string[]> {
        this.assertEmbeddingVector(embedding);

        if (!Number.isInteger(topK) || topK <= 0) {
            throw new Error("topK must be a positive integer");
        }

        if (!Number.isFinite(threshold) || threshold < 0) {
            throw new Error("threshold must be a finite number >= 0");
        }

        const result = await this.doQuery(embedding, topK, threshold);

        if (!Array.isArray(result) || result.some((value) => typeof value !== "string")) {
            throw new Error("query result must be a string array");
        }

        return result;
    }

    async reset(): Promise<void> {
        await this.doReset();
    }

    protected abstract doAdd(ids: string[], texts: string[], embeddings: number[][]): Promise<void>;
    protected abstract doQuery(embedding: number[], topK: number, threshold: number): Promise<string[]>;
    protected abstract doReset(): Promise<void>;

    private assertEmbeddingVector(embedding: number[]): void {
        if (!Array.isArray(embedding) || embedding.length === 0) {
            throw new Error("embedding vector must be a non-empty number array");
        }

        if (embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
            throw new Error("embedding vector must contain finite numbers");
        }
    }
}
