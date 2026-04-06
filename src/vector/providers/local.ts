import { EmbeddingProvider } from "./base.js";

type TransformersExtractor = (
    input: string | string[],
    options?: Record<string, unknown>
) => Promise<unknown>;

type TransformersModule = {
    pipeline: (
        task: "feature-extraction",
        model: string,
        options: { device: string }
    ) => Promise<TransformersExtractor>;
};

type TensorLike = {
    dims?: unknown;
    data?: unknown;
};

type LocalProviderOptions = {
    model?: string;
    device?: string;
    normalizeEmbeddings?: boolean;
    loader?: () => Promise<TransformersModule>;
};

export class LocalTransformersProvider extends EmbeddingProvider {
    private readonly model: string;
    private readonly device: string;
    private readonly normalizeEmbeddings: boolean;
    private readonly loader: () => Promise<TransformersModule>;
    private extractorPromise?: Promise<TransformersExtractor>;

    constructor(options: LocalProviderOptions = {}) {
        super();
        this.model = options.model ?? "Xenova/all-MiniLM-L6-v2";
        this.device = options.device ?? "cpu";
        this.normalizeEmbeddings = options.normalizeEmbeddings ?? true;
        this.loader = options.loader ?? this.defaultLoader;
    }

    protected async doEmbedDocuments(documents: string[]): Promise<number[][]> {
        const extractor = await this.getExtractor();
        const raw = await extractor(documents, {
            pooling: "mean",
            normalize: this.normalizeEmbeddings
        });

        return this.normalizeResult(raw, documents.length);
    }

    protected async doEmbedQuery(query: string): Promise<number[]> {
        const extractor = await this.getExtractor();
        const raw = await extractor(query, {
            pooling: "mean",
            normalize: this.normalizeEmbeddings
        });

        const embeddings = this.normalizeResult(raw, 1);
        const firstEmbedding = embeddings[0];
        if (!firstEmbedding) {
            throw new Error("Unexpected embeddings shape returned by @xenova/transformers");
        }
        return firstEmbedding;
    }

    private async getExtractor(): Promise<TransformersExtractor> {
        this.extractorPromise ??= this.createExtractor();
        return this.extractorPromise;
    }

    private async createExtractor(): Promise<TransformersExtractor> {
        const module = await this.loader().catch(() => {
            throw new Error(
                "Local embedding provider requires optional dependency @xenova/transformers. Install it with: npm i @xenova/transformers"
            );
        });

        if (!module || typeof module.pipeline !== "function") {
            throw new Error("Invalid @xenova/transformers module: missing pipeline export");
        }

        return module.pipeline("feature-extraction", this.model, { device: this.device });
    }

    private async defaultLoader(): Promise<TransformersModule> {
        const importer = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
        const loaded = await importer("@xenova/transformers");
        return loaded as TransformersModule;
    }

    private normalizeResult(raw: unknown, expectedCount: number): number[][] {
        const rows = this.extractRows(raw);
        if (rows.length !== expectedCount) {
            throw new Error("Unexpected embeddings shape returned by @xenova/transformers");
        }

        return rows;
    }

    private extractRows(raw: unknown): number[][] {
        const rowsFromTensor = this.extractTensorRows(raw);
        if (rowsFromTensor !== null) {
            return rowsFromTensor;
        }

        if (Array.isArray(raw)) {
            if (raw.length === 0) {
                return [];
            }

            if (Array.isArray(raw[0])) {
                return raw.map((row) => this.toNumberArray(row));
            }

            return [this.toNumberArray(raw)];
        }

        if (ArrayBuffer.isView(raw)) {
            return [this.toNumberArray(raw)];
        }

        const maybeData = (raw as { data?: unknown } | null)?.data;
        if (maybeData !== undefined) {
            return this.extractRows(maybeData);
        }

        throw new Error("Unable to parse embeddings returned by @xenova/transformers");
    }

    private extractTensorRows(raw: unknown): number[][] | null {
        if (!raw || typeof raw !== "object") {
            return null;
        }

        const tensor = raw as TensorLike;
        if (!Array.isArray(tensor.dims)) {
            return null;
        }

        const dims = tensor.dims;
        if (!dims.every((dim) => Number.isInteger(dim) && (dim as number) >= 0)) {
            throw new Error("Unable to parse embeddings returned by @xenova/transformers");
        }

        const data = this.toNumberArray(tensor.data);

        if (dims.length === 0) {
            if (data.length === 0) {
                return [];
            }
            return [data];
        }

        if (dims.length === 1) {
            const vectorSize = dims[0] as number;
            if (vectorSize !== data.length) {
                throw new Error("Unable to parse embeddings returned by @xenova/transformers");
            }
            return [data];
        }

        const rowCount = dims[0] as number;
        const rowSize = dims.slice(1).reduce((acc, size) => acc * (size as number), 1);

        if (rowCount * rowSize !== data.length) {
            throw new Error("Unable to parse embeddings returned by @xenova/transformers");
        }

        const rows: number[][] = [];
        for (let row = 0; row < rowCount; row += 1) {
            const start = row * rowSize;
            rows.push(data.slice(start, start + rowSize));
        }

        return rows;
    }

    private toNumberArray(value: unknown): number[] {
        if (!Array.isArray(value)) {
            if (ArrayBuffer.isView(value)) {
                if (!("length" in value) || typeof (value as { length: unknown }).length !== "number") {
                    throw new Error("Unable to parse embeddings returned by @xenova/transformers");
                }

                const result: number[] = [];
                const view = value as unknown as { readonly length: number; [index: number]: unknown };

                for (let index = 0; index < view.length; index += 1) {
                    const item = view[index];
                    if (typeof item !== "number" || !Number.isFinite(item)) {
                        throw new Error("Embedding values must be finite numbers");
                    }
                    result.push(item);
                }

                return result;
            }
            throw new Error("Unable to parse embeddings returned by @xenova/transformers");
        }

        return value.map((item) => {
            if (typeof item !== "number" || !Number.isFinite(item)) {
                throw new Error("Embedding values must be finite numbers");
            }
            return item;
        });
    }
}
