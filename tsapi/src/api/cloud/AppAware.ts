/* A service that knows which deployed app it belongs to. The id always comes
   from the environment (ANBARIC_APP_ID), never a constructor argument, so a
   developer never has to supply it. Hosted services (the state machine, the
   cloud/Postgres stores) implement this; purely local in-memory ones do not. */
interface AppAware {
    getAppId() : string;
}

// The current app's id from the environment, or "" when running outside a
// deployed app (locally). The single source for every AppAware implementation.
const currentAppId = () : string => process.env.ANBARIC_APP_ID ?? "";

export { currentAppId };
export type { AppAware };
