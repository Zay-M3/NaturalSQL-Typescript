import type { AppConfig, EmbeddingProviderType, VectorBackend } from "./utils/config.js";
import { createConfig } from "./utils/config.js";

export interface NaturalSQLOptions {
    dbUrl?: string | null;
    dbType?: string;
    normalizeEmbeddings?: boolean;
    device?: string;
    vectorBackend?: VectorBackend;
    embeddingProvider?: EmbeddingProviderType;
    geminiApiKey?: string | null;
    geminiEmbeddingModel?: string;
    vectorDistanceThreshold?: number;
}

export interface BuildVectorDbResult {
    storagePath: string;
    indexedTables: number;
    fromCache: boolean;
}

export class NaturalSQL {
    private readonly config: AppConfig;

    constructor(options: NaturalSQLOptions = {}) {
        this.config = createConfig({
            dbUrl: options.dbUrl ?? null,
            dbType: options.dbType ?? "sqlite",
            normalizeEmbeddings: options.normalizeEmbeddings ?? true,
            device: options.device ?? "cpu",
            vectorBackend: options.vectorBackend ?? "sqlite",
            embeddingProvider: options.embeddingProvider ?? "local",
            geminiApiKey: options.geminiApiKey ?? null,
            geminiEmbeddingModel: options.geminiEmbeddingModel ?? "text-embedding-004",
            vectorDistanceThreshold: options.vectorDistanceThreshold ?? 0.35
        });
    }

    getConfig(): AppConfig {
        return this.config;
    }

    async buildVectorDb(_storagePath: string): Promise<BuildVectorDbResult> {
        return {
            storagePath: _storagePath,
            indexedTables: 0,
            fromCache: false
        };
    }
}
