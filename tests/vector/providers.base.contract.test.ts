import { describe, expect, it } from "vitest";

import { EmbeddingProvider } from "../../src/vector/providers/base.js";

class GoodProvider extends EmbeddingProvider {
    protected async doEmbedDocuments(documents: string[]): Promise<number[][]> {
        return documents.map((_, index) => [index + 1, 0.5]);
    }

    protected async doEmbedQuery(): Promise<number[]> {
        return [1, 0.5];
    }
}

class BadProviderWrongCount extends EmbeddingProvider {
    protected async doEmbedDocuments(): Promise<number[][]> {
        return [[1, 2]];
    }

    protected async doEmbedQuery(): Promise<number[]> {
        return [1];
    }
}

describe("EmbeddingProvider contract", () => {
    it("valida entrada y salida de embedDocuments", async () => {
        const provider = new GoodProvider();

        await expect(provider.embedDocuments(["doc-1", "doc-2"]))
            .resolves
            .toEqual([[1, 0.5], [2, 0.5]]);

        await expect(provider.embedDocuments([])).rejects.toThrow("documents must be a non-empty string array");
    });

    it("valida query y embedding generado", async () => {
        const provider = new GoodProvider();

        await expect(provider.embedQuery("find users")).resolves.toEqual([1, 0.5]);
        await expect(provider.embedQuery("   ")).rejects.toThrow("query must be a non-empty string");
    });

    it("detecta contratos invalidos de implementacion", async () => {
        const provider = new BadProviderWrongCount();

        await expect(provider.embedDocuments(["doc-1", "doc-2"]))
            .rejects
            .toThrow("embedding count must match documents count");
    });
});
