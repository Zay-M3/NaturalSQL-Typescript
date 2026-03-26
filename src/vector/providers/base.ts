export abstract class EmbeddingProvider {
    abstract embedDocuments(documents: string[]): Promise<number[][]>;
    abstract embedQuery(query: string): Promise<number[]>;
}
