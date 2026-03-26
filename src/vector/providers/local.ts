import { EmbeddingProvider } from "./base.js";

export class LocalTransformersProvider extends EmbeddingProvider {
    async embedDocuments(documents: string[]): Promise<number[][]> {
        return documents.map(() => []);
    }

    async embedQuery(_query: string): Promise<number[]> {
        return [];
    }
}
