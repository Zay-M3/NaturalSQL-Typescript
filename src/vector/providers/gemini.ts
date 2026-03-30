import { EmbeddingProvider } from "./base.js";

type GeminiModel = {
    embedContent(input: { content: { parts: Array<{ text: string }> }; taskType: string }): Promise<{
        embedding?: { values?: number[] };
    }>;
};

type GeminiClient = {
    getGenerativeModel(config: { model: string }): GeminiModel;
};

type GeminiModule = {
    GoogleGenerativeAI: new (apiKey: string) => GeminiClient;
};

type GeminiProviderOptions = {
    apiKey?: string | null;
    model?: string;
    loader?: () => Promise<GeminiModule>;
};

export class GeminiEmbeddingProvider extends EmbeddingProvider {
    private readonly apiKey: string;
    private readonly model: string;
    private readonly loader: () => Promise<GeminiModule>;
    private modelPromise?: Promise<GeminiModel>;

    constructor(options: GeminiProviderOptions = {}) {
        super();

        const apiKey = options.apiKey?.trim() ?? "";
        if (!apiKey) {
            throw new Error("Gemini API key is required for embeddingProvider='gemini'");
        }

        this.apiKey = apiKey;
        this.model = options.model ?? "text-embedding-004";
        this.loader = options.loader ?? this.defaultLoader;
    }

    protected async doEmbedDocuments(documents: string[]): Promise<number[][]> {
        const model = await this.getModel();
        const embeddings: number[][] = [];

        for (const text of documents) {
            const values = await this.embedSingle(model, text, "RETRIEVAL_DOCUMENT");
            embeddings.push(values);
        }

        return embeddings;
    }

    protected async doEmbedQuery(query: string): Promise<number[]> {
        const model = await this.getModel();
        return this.embedSingle(model, query, "RETRIEVAL_QUERY");
    }

    private async getModel(): Promise<GeminiModel> {
        this.modelPromise ??= this.createModel();
        return this.modelPromise;
    }

    private async createModel(): Promise<GeminiModel> {
        const module = await this.loader().catch(() => {
            throw new Error(
                "Gemini embedding provider requires optional dependency @google/generative-ai. Install it with: npm i @google/generative-ai"
            );
        });

        if (!module || typeof module.GoogleGenerativeAI !== "function") {
            throw new Error("Invalid @google/generative-ai module: missing GoogleGenerativeAI export");
        }

        const client = new module.GoogleGenerativeAI(this.apiKey);
        return client.getGenerativeModel({ model: this.model });
    }

    private async defaultLoader(): Promise<GeminiModule> {
        const importer = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
        const loaded = await importer("@google/generative-ai");
        return loaded as GeminiModule;
    }

    private async embedSingle(model: GeminiModel, text: string, taskType: string): Promise<number[]> {
        const response = await model.embedContent({
            content: { parts: [{ text }] },
            taskType
        });

        const values = response.embedding?.values;
        if (!Array.isArray(values) || values.length === 0) {
            throw new Error("Gemini embedding response did not include embedding values");
        }

        for (const value of values) {
            if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new Error("Gemini embedding values must be finite numbers");
            }
        }

        return values;
    }
}
