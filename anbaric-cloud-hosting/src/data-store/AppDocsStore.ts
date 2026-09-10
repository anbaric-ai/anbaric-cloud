type AppDoc = {
    slug : string,
    title : string,
    markdown : string,
};

/* Generated user documentation for an app. Docs are regenerated wholesale on
   every deploy, so the store replaces an app's whole set at once rather than
   upserting doc by doc - a doc that no longer applies after a redeploy must not
   linger. */
interface AppDocsStore {

    replaceForApp(appId : string, docs : Array<AppDoc>) : Promise<void>;

    listForApp(appId : string) : Promise<Array<AppDoc>>;

}

export type { AppDoc, AppDocsStore };
