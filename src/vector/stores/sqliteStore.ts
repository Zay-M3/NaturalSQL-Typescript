import { VectorStore } from "./base.js";

export class SQLiteVectorStore extends VectorStore {
    async add(_ids: string[], _texts: string[], _embeddings: number[][]): Promise<void> {
        return;
    }

    async query(_embedding: number[], _topK: number, _threshold: number): Promise<string[]> {
        return [];
    }

    async reset(): Promise<void> {
        return;
    }
}
