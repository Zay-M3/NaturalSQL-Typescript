import type { AppConfig } from "../utils/config.js";
import type { EmbeddingProvider } from "../vector/providers/base.js";
import type { VectorStore } from "../vector/stores/base.js";
import { createEmbeddingProvider, createVectorStore } from "../vector/factory.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createHash } from "node:crypto";

type CacheMetadata = {
    version: 1;
    vectorBackend: AppConfig["vectorBackend"];
    embeddingProvider: AppConfig["embeddingProvider"];
    cacheKey: string;
    indexedTables: number;
};

type VectorManagerDependencies = {
    createEmbeddingProvider?: (config: AppConfig) => Promise<EmbeddingProvider>;
    createVectorStore?: (config: AppConfig, storagePath: string, reset: boolean) => Promise<VectorStore>;
};

export type VectorManagerCreateOptions = {
    forceReset?: boolean;
    cacheKey?: string;
    dependencies?: VectorManagerDependencies;
};

export class VectorManager {
    private static readonly CACHE_FILE_NAME = "index-cache.json";

    private constructor(
        private readonly provider: EmbeddingProvider,
        private readonly store: VectorStore,
        private readonly config: AppConfig,
        private readonly storagePath: string,
        private readonly cacheKey: string,
        private readonly fromCache: boolean,
        private indexedTables: number
    ) { }

    static async create(
        config: AppConfig,
        storagePath: string,
        options: VectorManagerCreateOptions = {}
    ): Promise<VectorManager> {
        const cacheKey = options.cacheKey?.trim() || "default";
        const metadata = await this.readCacheMetadata(storagePath);

        const canReuse = !options.forceReset
            && metadata !== null
            && metadata.vectorBackend === config.vectorBackend
            && metadata.embeddingProvider === config.embeddingProvider
            && metadata.cacheKey === cacheKey
            && metadata.indexedTables > 0;

        const makeProvider = options.dependencies?.createEmbeddingProvider ?? createEmbeddingProvider;
        const makeStore = options.dependencies?.createVectorStore ?? createVectorStore;

        const provider = await makeProvider(config);
        const store = await makeStore(config, storagePath, !canReuse);

        return new VectorManager(
            provider,
            store,
            config,
            storagePath,
            cacheKey,
            canReuse,
            canReuse ? metadata.indexedTables : 0
        );
    }

    async upsert(documents: string[]): Promise<void> {
        if (documents.length === 0) {
            return;
        }

        const ids = documents.map((document, index) => {
            const digest = createHash("sha1").update(document).digest("hex").slice(0, 12);
            return `table-${index}-${digest}`;
        });

        const embeddings = await this.provider.embedDocuments(documents);
        await this.store.add(ids, documents, embeddings);

        this.indexedTables = documents.length;
        await VectorManager.writeCacheMetadata(this.storagePath, {
            version: 1,
            vectorBackend: this.config.vectorBackend,
            embeddingProvider: this.config.embeddingProvider,
            cacheKey: this.cacheKey,
            indexedTables: this.indexedTables
        });
    }

    async search(question: string, topK: number, threshold: number): Promise<string[]> {
        const queryEmbedding = await this.provider.embedQuery(question);
        return this.store.query(queryEmbedding, topK, threshold);
    }

    isFromCache(): boolean {
        return this.fromCache;
    }

    getIndexedTablesCount(): number {
        return this.indexedTables;
    }

    private static cacheMetadataPath(storagePath: string): string {
        return path.join(storagePath, this.CACHE_FILE_NAME);
    }

    private static async readCacheMetadata(storagePath: string): Promise<CacheMetadata | null> {
        try {
            const raw = await fs.readFile(this.cacheMetadataPath(storagePath), "utf8");
            const parsed = JSON.parse(raw) as Partial<CacheMetadata>;

            if (
                parsed.version === 1
                && typeof parsed.cacheKey === "string"
                && typeof parsed.indexedTables === "number"
                && (parsed.vectorBackend === "sqlite" || parsed.vectorBackend === "chroma")
                && (parsed.embeddingProvider === "local" || parsed.embeddingProvider === "gemini")
            ) {
                return parsed as CacheMetadata;
            }

            return null;
        } catch {
            return null;
        }
    }

    private static async writeCacheMetadata(storagePath: string, metadata: CacheMetadata): Promise<void> {
        await fs.mkdir(storagePath, { recursive: true });
        await fs.writeFile(this.cacheMetadataPath(storagePath), JSON.stringify(metadata, null, 2), "utf8");
    }
}
