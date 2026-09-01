import {afterEach, describe, expect, it} from "vitest";
import {SqlStoreFactory} from "../src/SqlStoreFactory";
import {SqliteSqlStore} from "../src/SqliteSqlStore";
import {PostgresSqlStore} from "../src/PostgresSqlStore";

describe("SqlStoreFactory", () => {

    const original = process.env.ANBARIC_SQL_STORE_TYPE;
    const originalApp = process.env.ANBARIC_APP_ID;
    afterEach(() => {
        if (original === undefined) delete process.env.ANBARIC_SQL_STORE_TYPE;
        else process.env.ANBARIC_SQL_STORE_TYPE = original;
        if (originalApp === undefined) delete process.env.ANBARIC_APP_ID;
        else process.env.ANBARIC_APP_ID = originalApp;
    });

    it("defaults to SQLite locally", () => {
        delete process.env.ANBARIC_SQL_STORE_TYPE;
        expect(SqlStoreFactory.instance()).toBeInstanceOf(SqliteSqlStore);
    });

    it("uses PostgreSQL when the platform sets cloud, in a schema named after the app", () => {
        process.env.ANBARIC_SQL_STORE_TYPE = "cloud";
        process.env.ANBARIC_APP_ID = "ci-bulletin";   // a deployed app always has one
        expect(SqlStoreFactory.instance()).toBeInstanceOf(PostgresSqlStore);
    });

});
