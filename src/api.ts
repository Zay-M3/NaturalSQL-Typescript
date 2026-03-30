import type { AppConfig, EmbeddingProviderType, VectorBackend } from "./utils/config.js";
import { createConfig } from "./utils/config.js";
import { Connection } from "./sql/connection.js";
import { SQLSchemaExtractor } from "./sql/schemaExtractor.js";
import { VectorManager, type VectorManagerCreateOptions } from "./controller/vectorManager.js";
import { createHash } from "node:crypto";

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

export interface BuildVectorDbOptions {
    forceReset?: boolean;
    cacheKey?: string;
    dependencies?: VectorManagerCreateOptions["dependencies"];
}

export interface SearchOptions {
    storagePath?: string;
    limit?: number;
    dependencies?: VectorManagerCreateOptions["dependencies"];
}

export interface BuildVectorDbResult {
    storagePath: string;
    indexedTables: number;
    fromCache: boolean;
}

export class NaturalSQL {
    private static readonly SUPPORTED_COMBINATIONS = new Set<string>([
        "chroma:local",
        "sqlite:local",
        "sqlite:gemini",
        "chroma:gemini"
    ]);

    private readonly config: AppConfig;
    private vectorManager: VectorManager | null = null;
    private vectorManagerStoragePath: string | null = null;
    private vectorManagerCacheKey: string | null = null;

    constructor(options: NaturalSQLOptions = {}) {
        const config = createConfig({
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

        this.validateCombination(config.vectorBackend, config.embeddingProvider);
        this.validateGeminiOptions(config.embeddingProvider, config.geminiApiKey);

        this.config = config;
    }

    getConfig(): AppConfig {
        return this.config;
    }

    async buildVectorDb(storagePath: string, options: BuildVectorDbOptions = {}): Promise<BuildVectorDbResult> {
        if (!this.config.dbUrl) {
            throw new Error("buildVectorDb requires dbUrl in NaturalSQL configuration");
        }

        const forceReset = options.forceReset ?? false;
        if (forceReset) {
            this.invalidateVectorManagerCache();
        }

        const connection = new Connection(this.config);
        const rawConnection = await connection.connect();

        try {
            const extractor = new SQLSchemaExtractor(rawConnection);
            const schema = await extractor.extractSchema();
            const formatted = extractor.formatForAI(schema);
            const cacheKey = options.cacheKey ?? this.computeCacheKey(formatted);

            if (
                !forceReset
                && this.vectorManager
                && this.vectorManagerStoragePath === storagePath
                && this.vectorManagerCacheKey === cacheKey
                && this.vectorManager.getIndexedTablesCount() > 0
            ) {
                return {
                    storagePath,
                    indexedTables: this.vectorManager.getIndexedTablesCount(),
                    fromCache: true
                };
            }

            const manager = await this.getOrCreateVectorManager(storagePath, cacheKey, {
                forceReset,
                dependencies: options.dependencies
            });

            if (!manager.isFromCache()) {
                await manager.upsert(formatted);
            }

            return {
                storagePath,
                indexedTables: manager.getIndexedTablesCount(),
                fromCache: manager.isFromCache()
            };
        } finally {
            await rawConnection.close();
        }
    }

    async search(request: string, options: SearchOptions = {}): Promise<string[]> {
        const storagePath = options.storagePath ?? "./metadata_vdb";
        const limit = options.limit ?? 3;

        if (typeof request !== "string" || request.trim() === "") {
            throw new Error("search request must be a non-empty string");
        }

        if (this.vectorManager && this.vectorManagerStoragePath === storagePath) {
            return this.vectorManager.search(request, limit, this.config.vectorDistanceThreshold);
        }

        const manager = await this.getOrCreateVectorManager(storagePath, "search", {
            forceReset: false,
            dependencies: options.dependencies
        });

        return manager.search(request, limit, this.config.vectorDistanceThreshold);
    }

    private validateCombination(vectorBackend: VectorBackend, embeddingProvider: EmbeddingProviderType): void {
        const combination = `${vectorBackend}:${embeddingProvider}`;
        if (!NaturalSQL.SUPPORTED_COMBINATIONS.has(combination)) {
            throw new Error(
                `Unsupported combination (${vectorBackend}, ${embeddingProvider}). Supported combinations: chroma+local, sqlite+local, sqlite+gemini, chroma+gemini`
            );
        }
    }

    private validateGeminiOptions(embeddingProvider: EmbeddingProviderType, geminiApiKey: string | null): void {
        if (embeddingProvider === "gemini" && !geminiApiKey) {
            throw new Error("geminiApiKey is required when embeddingProvider='gemini'");
        }

        if (embeddingProvider !== "gemini" && geminiApiKey) {
            throw new Error("geminiApiKey should only be provided when embeddingProvider='gemini'");
        }
    }

    private computeCacheKey(formattedTables: string[]): string {
        return createHash("sha1").update(formattedTables.join("\n")).digest("hex");
    }

    private invalidateVectorManagerCache(): void {
        this.vectorManager = null;
        this.vectorManagerStoragePath = null;
        this.vectorManagerCacheKey = null;
    }

    private async getOrCreateVectorManager(
        storagePath: string,
        cacheKey: string,
        options: BuildVectorDbOptions
    ): Promise<VectorManager> {
        const canReuseInMemory = this.vectorManager
            && this.vectorManagerStoragePath === storagePath
            && this.vectorManagerCacheKey === cacheKey
            && !options.forceReset;

        if (canReuseInMemory && this.vectorManager) {
            return this.vectorManager;
        }

        const manager = await VectorManager.create(this.config, storagePath, {
            forceReset: options.forceReset,
            cacheKey,
            dependencies: options.dependencies
        });

        this.vectorManager = manager;
        this.vectorManagerStoragePath = storagePath;
        this.vectorManagerCacheKey = cacheKey;

        return manager;
    }

}
