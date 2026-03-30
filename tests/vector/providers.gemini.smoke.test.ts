import { describe, expect, it } from "vitest";

import { GeminiEmbeddingProvider } from "../../src/vector/providers/gemini.js";

describe("GeminiEmbeddingProvider", () => {
    it("genera embeddings para documentos y query (smoke)", async () => {
        const provider = new GeminiEmbeddingProvider({
            apiKey: "api-key",
            loader: async () => ({
                GoogleGenerativeAI: class {
                    getGenerativeModel() {
                        return {
                            async embedContent({ taskType }: { taskType: string }) {
                                if (taskType === "RETRIEVAL_DOCUMENT") {
                                    return { embedding: { values: [0.4, 0.6] } };
                                }
                                return { embedding: { values: [0.8, 0.2] } };
                            }
                        };
                    }
                }
            })
        });

        await expect(provider.embedDocuments(["users schema", "orders schema"]))
            .resolves
            .toEqual([[0.4, 0.6], [0.4, 0.6]]);

        await expect(provider.embedQuery("find users")).resolves.toEqual([0.8, 0.2]);
    });

    it("falla si no hay api key", () => {
        expect(() => new GeminiEmbeddingProvider({ apiKey: "" })).toThrow(
            "Gemini API key is required for embeddingProvider='gemini'"
        );
    });

    it("muestra mensaje accionable cuando falta dependencia opcional", async () => {
        const provider = new GeminiEmbeddingProvider({
            apiKey: "api-key",
            loader: async () => {
                throw new Error("module not found");
            }
        });

        await expect(provider.embedQuery("test")).rejects.toThrow(
            "Gemini embedding provider requires optional dependency @google/generative-ai"
        );
    });
});
