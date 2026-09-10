type AppDoc = {
    slug : string,
    title : string,
    markdown : string,
    parentSlug : string | null,
    position : number,
};

/* Generated user documentation for an app, held as a shallow tree: root docs
   (an "Introduction" and, verbatim, any README) have a null parent, and every
   other doc names its parent's slug, ordered among its siblings by position.
   Docs are regenerated wholesale on every deploy, so the store replaces an
   app's whole set at once rather than upserting doc by doc - a doc that no
   longer applies after a redeploy must not linger. */
interface AppDocsStore {

    replaceForApp(appId : string, docs : Array<AppDoc>) : Promise<void>;

    listForApp(appId : string) : Promise<Array<AppDoc>>;

}

export type { AppDoc, AppDocsStore };
