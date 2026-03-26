export type VectorBackend = "chroma" | "sqlite";
export type EmbeddingProviderType = "local" | "gemini";

export interface AppConfig {
    readonly dbUrl: string | null;
    readonly dbType: string;
    readonly normalizeEmbeddings: boolean;
    readonly device: string;
    readonly vectorBackend: VectorBackend;
    readonly embeddingProvider: EmbeddingProviderType;
    readonly geminiApiKey: string | null;
    readonly geminiEmbeddingModel: string;
    readonly vectorDistanceThreshold: number;
}

export function createConfig(params: AppConfig): AppConfig {
    return Object.freeze({ ...params });
}
