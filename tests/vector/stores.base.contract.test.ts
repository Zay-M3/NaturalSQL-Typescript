import { describe, expect, it } from "vitest";

import { VectorStore } from "../../src/vector/stores/base.js";

class InMemoryVectorStore extends VectorStore {
    public addCalled = 0;
    public resetCalled = 0;

    protected async doAdd(): Promise<void> {
        this.addCalled += 1;
    }

    protected async doQuery(): Promise<string[]> {
        return ["users", "orders"];
    }

    protected async doReset(): Promise<void> {
        this.resetCalled += 1;
    }
}

describe("VectorStore contract", () => {
    it("valida add y delega al store concreto", async () => {
        const store = new InMemoryVectorStore();

        await store.add(["1"], ["doc 1"], [[0.1, 0.2]]);
        expect(store.addCalled).toBe(1);

        await expect(store.add(["1", "2"], ["doc 1"], [[0.1]])).rejects.toThrow(
            "ids, texts and embeddings must have the same length"
        );
    });

    it("valida query y devuelve resultado tipado", async () => {
        const store = new InMemoryVectorStore();

        await expect(store.query([0.1, 0.2], 3, 0.5)).resolves.toEqual(["users", "orders"]);
        await expect(store.query([], 3, 0.5)).rejects.toThrow("embedding vector must be a non-empty number array");
        await expect(store.query([0.1], 0, 0.5)).rejects.toThrow("topK must be a positive integer");
    });

    it("ejecuta reset del store concreto", async () => {
        const store = new InMemoryVectorStore();

        await store.reset();
        expect(store.resetCalled).toBe(1);
    });
});
