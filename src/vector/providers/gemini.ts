import { EmbeddingProvider } from "./base.js";

export class GeminiEmbeddingProvider extends EmbeddingProvider {
    protected async doEmbedDocuments(documents: string[]): Promise<number[][]> {
        return documents.map(() => [0]);
    }

    protected async doEmbedQuery(_query: string): Promise<number[]> {
        return [0];
    }
}
