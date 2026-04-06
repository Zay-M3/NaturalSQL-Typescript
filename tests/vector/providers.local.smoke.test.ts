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

    it("parsea tensor 2D con Float32Array para documentos", async () => {
        const provider = new LocalTransformersProvider({
            loader: async () => ({
                pipeline: async () => async (input) => {
                    if (!Array.isArray(input)) {
                        return { dims: [2], data: new Float32Array([9, 0.1]) };
                    }

                    return {
                        dims: [input.length, 2],
                        data: new Float32Array(
                            input.flatMap((_, index) => [index + 1, 0.5])
                        )
                    };
                }
            })
        });

        await expect(provider.embedDocuments(["users", "orders"]))
            .resolves
            .toEqual([[1, 0.5], [2, 0.5]]);
    });

    it("parsea tensor 1D con Float32Array para query", async () => {
        const provider = new LocalTransformersProvider({
            loader: async () => ({
                pipeline: async () => async () => ({
                    dims: [2],
                    data: new Float32Array([0.25, 0.75])
                })
            })
        });

        await expect(provider.embedQuery("find users")).resolves.toEqual([0.25, 0.75]);
    });

    it("mantiene compatibilidad con array de arrays", async () => {
        const provider = new LocalTransformersProvider({
            loader: async () => ({
                pipeline: async () => async (input) => {
                    if (Array.isArray(input)) {
                        return [[1, 0], [0, 1]];
                    }
                    return [1, 0];
                }
            })
        });

        await expect(provider.embedDocuments(["users", "orders"]))
            .resolves
            .toEqual([[1, 0], [0, 1]]);
        await expect(provider.embedQuery("users")).resolves.toEqual([1, 0]);
    });

    it("falla con error controlado cuando dims y data son inconsistentes", async () => {
        const provider = new LocalTransformersProvider({
            loader: async () => ({
                pipeline: async () => async () => ({
                    dims: [2, 2],
                    data: new Float32Array([1, 2, 3])
                })
            })
        });

        await expect(provider.embedDocuments(["users", "orders"]))
            .rejects
            .toThrow("Unable to parse embeddings returned by @xenova/transformers");
    });
});
