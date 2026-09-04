import {NoOpAuditor, SqlStore} from "anbaric-tsapi";
import {CloudAuditor} from "anbaric-impl-cloud";
import {PostgresSqlStore} from "./PostgresSqlStore.js";
import {SqliteSqlStore} from "./SqliteSqlStore.js";

/* Chooses the SQL backend from the environment: SQLite locally by default, and
   the tenant's shared PostgreSQL when the platform sets ANBARIC_SQL_STORE_TYPE
   to "cloud" on a deployed app. */
const SqlStoreFactory = {

    instance() : SqlStore {
        switch (process.env.ANBARIC_SQL_STORE_TYPE) {
            case "cloud":
            case "postgres":
                return new PostgresSqlStore(new CloudAuditor());
            case "sqlite":
            default:
                return new SqliteSqlStore(new NoOpAuditor());
        }
    }

}

export { SqlStoreFactory };
