export abstract class VectorStore {
    abstract add(ids: string[], texts: string[], embeddings: number[][]): Promise<void>;
    abstract query(embedding: number[], topK: number, threshold: number): Promise<string[]>;
    abstract reset(): Promise<void>;
}
