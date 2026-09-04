import {afterEach, describe, expect, it} from "vitest";
import {SqlStoreFactory} from "../src/SqlStoreFactory.js";
import {SqliteSqlStore} from "../src/SqliteSqlStore.js";
import {PostgresSqlStore} from "../src/PostgresSqlStore.js";

describe("SqlStoreFactory", () => {

    const original = process.env.ANBARIC_SQL_STORE_TYPE;
    afterEach(() => {
        if (original === undefined) delete process.env.ANBARIC_SQL_STORE_TYPE;
        else process.env.ANBARIC_SQL_STORE_TYPE = original;
    });

    it("defaults to SQLite locally", () => {
        delete process.env.ANBARIC_SQL_STORE_TYPE;
        expect(SqlStoreFactory.instance()).toBeInstanceOf(SqliteSqlStore);
    });

    it("uses PostgreSQL when the platform sets cloud", () => {
        process.env.ANBARIC_SQL_STORE_TYPE = "cloud";
        expect(SqlStoreFactory.instance()).toBeInstanceOf(PostgresSqlStore);
    });

});
