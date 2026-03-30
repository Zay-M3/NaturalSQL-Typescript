import { describe, expect, it } from "vitest";

import { createConfig } from "../../src/utils/config.js";

describe("createConfig", () => {
    it("aplica valores por defecto", () => {
        const config = createConfig();

        expect(config).toEqual({
            dbUrl: null,
            dbType: "sqlite",
            normalizeEmbeddings: true,
            device: "cpu",
            vectorBackend: "sqlite",
            embeddingProvider: "local",
            geminiApiKey: null,
            geminiEmbeddingModel: "text-embedding-004",
            vectorDistanceThreshold: 0.35
        });
    });

    it("permite sobrescribir valores", () => {
        const config = createConfig({
            dbUrl: "postgresql://localhost:5432/db",
            dbType: "postgresql",
            normalizeEmbeddings: false,
            device: "cuda",
            vectorBackend: "chroma",
            embeddingProvider: "gemini",
            geminiApiKey: "key",
            geminiEmbeddingModel: "models/text-embedding-004",
            vectorDistanceThreshold: 0.7
        });

        expect(config.dbType).toBe("postgresql");
        expect(config.vectorBackend).toBe("chroma");
        expect(config.embeddingProvider).toBe("gemini");
        expect(config.normalizeEmbeddings).toBe(false);
        expect(config.device).toBe("cuda");
        expect(config.vectorDistanceThreshold).toBe(0.7);
    });

    it("retorna un objeto inmutable", () => {
        const config = createConfig();

        expect(Object.isFrozen(config)).toBe(true);
    });

    it("lanza error cuando dbType es vacio", () => {
        expect(() => createConfig({ dbType: "   " })).toThrow("dbType must be a non-empty string");
    });

    it("lanza error con vector backend invalido", () => {
        expect(() => createConfig({ vectorBackend: "invalid" as never })).toThrow("Unsupported vector backend");
    });

    it("lanza error con embedding provider invalido", () => {
        expect(() => createConfig({ embeddingProvider: "invalid" as never })).toThrow("Unsupported embedding provider");
    });

    it("lanza error con threshold invalido", () => {
        expect(() => createConfig({ vectorDistanceThreshold: -0.1 })).toThrow(
            "vectorDistanceThreshold must be a finite number >= 0"
        );
    });
});
