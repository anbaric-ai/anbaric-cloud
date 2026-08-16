import {describe, expect, it, vi} from "vitest";
import {HttpCliKeyStore} from "../../src/auth/HttpCliKeyStore";

const jsonResponse = (status : number, body : unknown = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const FOUND = { userId: "user-1", clientName: "chris laptop", publicKey: "PUBLIC-PEM", tenant: "internal" };

describe("HttpCliKeyStore", () => {

    it("looks a key up from the central registry with the shared secret", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) => jsonResponse(200, FOUND));
        const store = new HttpCliKeyStore("https://central.example", "shhh", fetchFn);

        const key = await store.find("key-1");

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://central.example/cli-keys/key-1");
        expect(init!.headers).toMatchObject({ "x-anbaric-central-key": "shhh" });
        expect(key?.userId).toBe("user-1");
        expect(key?.publicKey).toBe("PUBLIC-PEM");
        expect(key?.tenant).toBe("internal");
    });

    it("returns undefined for an unknown key", async () => {
        const store = new HttpCliKeyStore("https://central.example", "shhh",
            vi.fn(async (_url : string, _init : RequestInit) => jsonResponse(404)));

        expect(await store.find("key-9")).toBeUndefined();
    });

    it("caches lookups within the ttl", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) => jsonResponse(200, FOUND));
        const store = new HttpCliKeyStore("https://central.example", "shhh", fetchFn, 60_000);

        await store.find("key-1");
        await store.find("key-1");

        expect(fetchFn).toHaveBeenCalledOnce();
    });

    it("caches misses too", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) => jsonResponse(404));
        const store = new HttpCliKeyStore("https://central.example", "shhh", fetchFn, 60_000);

        await store.find("key-9");
        await store.find("key-9");

        expect(fetchFn).toHaveBeenCalledOnce();
    });

    it("raises on registry failures rather than treating them as missing keys", async () => {
        const store = new HttpCliKeyStore("https://central.example", "shhh",
            vi.fn(async (_url : string, _init : RequestInit) => jsonResponse(500)));

        await expect(store.find("key-1")).rejects.toThrowError("The key lookup failed with status 500");
    });

    it("refuses writes - keys live at the registry", async () => {
        const store = new HttpCliKeyStore("https://central.example", "shhh",
            vi.fn(async (_url : string, _init : RequestInit) => jsonResponse(200, FOUND)));

        await expect(store.save({} as any)).rejects.toThrowError(/issued by the central registry/);
        await expect(store.delete("key-1", "user-1")).rejects.toThrowError(/revoked at the central registry/);
        expect(await store.listFor("user-1")).toEqual([]);
    });

});
