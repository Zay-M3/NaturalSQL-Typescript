import { VectorStore } from "./base.js";

export class SQLiteVectorStore extends VectorStore {
    protected async doAdd(_ids: string[], _texts: string[], _embeddings: number[][]): Promise<void> {
        return;
    }

    protected async doQuery(_embedding: number[], _topK: number, _threshold: number): Promise<string[]> {
        return [];
    }

    protected async doReset(): Promise<void> {
        return;
    }
}
