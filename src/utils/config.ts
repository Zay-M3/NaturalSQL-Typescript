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

export type AppConfigInput = Partial<AppConfig>;

const VALID_VECTOR_BACKENDS = new Set<VectorBackend>(["chroma", "sqlite"]);
const VALID_EMBEDDING_PROVIDERS = new Set<EmbeddingProviderType>(["local", "gemini"]);

export function createConfig(params: AppConfigInput = {}): AppConfig {
    const dbType = params.dbType ?? "sqlite";
    const vectorBackend = params.vectorBackend ?? "sqlite";
    const embeddingProvider = params.embeddingProvider ?? "local";
    const vectorDistanceThreshold = params.vectorDistanceThreshold ?? 0.35;

    if (!dbType.trim()) {
        throw new Error("dbType must be a non-empty string");
    }

    if (!VALID_VECTOR_BACKENDS.has(vectorBackend)) {
        throw new Error(`Unsupported vector backend: ${String(vectorBackend)}`);
    }

    if (!VALID_EMBEDDING_PROVIDERS.has(embeddingProvider)) {
        throw new Error(`Unsupported embedding provider: ${String(embeddingProvider)}`);
    }

    if (!Number.isFinite(vectorDistanceThreshold) || vectorDistanceThreshold < 0) {
        throw new Error("vectorDistanceThreshold must be a finite number >= 0");
    }

    return Object.freeze({
        dbUrl: params.dbUrl ?? null,
        dbType,
        normalizeEmbeddings: params.normalizeEmbeddings ?? true,
        device: params.device ?? "cpu",
        vectorBackend,
        embeddingProvider,
        geminiApiKey: params.geminiApiKey ?? null,
        geminiEmbeddingModel: params.geminiEmbeddingModel ?? "text-embedding-004",
        vectorDistanceThreshold
    });
}
