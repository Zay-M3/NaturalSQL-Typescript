import { VectorStore } from "./base.js";

type ChromaQueryResult = {
    documents?: string[][];
    distances?: number[][];
};

type ChromaCollection = {
    upsert(input: { documents: string[]; ids: string[]; embeddings: number[][] }): Promise<void> | void;
    query(input: { query_embeddings: number[][]; n_results: number }): Promise<ChromaQueryResult> | ChromaQueryResult;
};

type ChromaClient = {
    getOrCreateCollection(input: { name: string; embeddingFunction: null }): Promise<ChromaCollection> | ChromaCollection;
    deleteCollection(input: { name: string }): Promise<void> | void;
};

type ChromaModule = {
    ChromaClient: new (input: { path: string }) => ChromaClient;
};

type ChromaStoreOptions = {
    storagePath: string;
    collectionName?: string;
    resetOnStart?: boolean;
    loader?: () => Promise<ChromaModule>;
};

export class ChromaVectorStore extends VectorStore {
    private readonly storagePath: string;
    private readonly collectionName: string;
    private readonly resetOnStart: boolean;
    private readonly loader: () => Promise<ChromaModule>;
    private collectionPromise?: Promise<ChromaCollection>;
    private clientPromise?: Promise<ChromaClient>;

    constructor(options: ChromaStoreOptions = { storagePath: ".naturalsql" }) {
        super();
        this.storagePath = options.storagePath;
        this.collectionName = options.collectionName ?? "db_schema";
        this.resetOnStart = options.resetOnStart ?? false;
        this.loader = options.loader ?? this.defaultLoader;
    }

    protected async doAdd(ids: string[], texts: string[], embeddings: number[][]): Promise<void> {
        const collection = await this.getCollection();
        await collection.upsert({ documents: texts, ids, embeddings });
    }

    protected async doQuery(embedding: number[], topK: number, threshold: number): Promise<string[]> {
        const collection = await this.getCollection();
        const result = await collection.query({
            query_embeddings: [embedding],
            n_results: topK
        });

        const documents = result.documents?.[0] ?? [];
        const distances = result.distances?.[0] ?? [];

        const filtered: string[] = [];
        for (let index = 0; index < documents.length; index += 1) {
            const document = documents[index];
            const distance = distances[index];
            if (
                typeof document === "string"
                && typeof distance === "number"
                && Number.isFinite(distance)
                && distance <= threshold
            ) {
                filtered.push(document);
            }
        }

        return filtered;
    }

    protected async doReset(): Promise<void> {
        const client = await this.getClient();
        try {
            await Promise.resolve(client.deleteCollection({ name: this.collectionName }));
        } catch {
            // Collection may not exist yet.
        }

        this.collectionPromise = Promise.resolve(client.getOrCreateCollection({
            name: this.collectionName,
            embeddingFunction: null
        }));
    }

    private async getCollection(): Promise<ChromaCollection> {
        this.collectionPromise ??= this.createCollection();
        return this.collectionPromise;
    }

    private async createCollection(): Promise<ChromaCollection> {
        const client = await this.getClient();

        if (this.resetOnStart) {
            try {
                await Promise.resolve(client.deleteCollection({ name: this.collectionName }));
            } catch {
                // Collection may not exist yet.
            }
        }

        return Promise.resolve(client.getOrCreateCollection({
            name: this.collectionName,
            embeddingFunction: null
        }));
    }

    private async getClient(): Promise<ChromaClient> {
        this.clientPromise ??= this.createClient();
        return this.clientPromise;
    }

    private async createClient(): Promise<ChromaClient> {
        const module = await this.loader().catch(() => {
            throw new Error("Chroma vector store requires optional dependency chromadb. Install it with: npm i chromadb");
        });

        if (!module || typeof module.ChromaClient !== "function") {
            throw new Error("Invalid chromadb module: missing ChromaClient export");
        }

        return new module.ChromaClient({ path: this.storagePath });
    }

    private async defaultLoader(): Promise<ChromaModule> {
        const importer = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
        const loaded = await importer("chromadb");
        return loaded as ChromaModule;
    }
}
