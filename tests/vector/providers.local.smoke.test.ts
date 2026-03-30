import { describe, expect, it } from "vitest";

import { LocalTransformersProvider } from "../../src/vector/providers/local.js";

describe("LocalTransformersProvider", () => {
    it("genera embeddings para documentos y query (smoke)", async () => {
        const provider = new LocalTransformersProvider({
            loader: async () => ({
                pipeline: async () => async (input) => {
                    if (Array.isArray(input)) {
                        return input.map((_, index) => [index + 1, 0.5]);
                    }
                    return [9, 0.1];
                }
            })
        });

        await expect(provider.embedDocuments(["users", "orders"]))
            .resolves
            .toEqual([[1, 0.5], [2, 0.5]]);

        await expect(provider.embedQuery("find users")).resolves.toEqual([9, 0.1]);
    });

    it("muestra mensaje accionable cuando falta dependencia opcional", async () => {
        const provider = new LocalTransformersProvider({
            loader: async () => {
                throw new Error("module not found");
            }
        });

        await expect(provider.embedQuery("test")).rejects.toThrow(
            "Local embedding provider requires optional dependency @xenova/transformers"
        );
    });
});
