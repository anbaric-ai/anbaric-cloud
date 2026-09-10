import {AppDoc, AppDocsStore} from "./AppDocsStore";

class InMemoryAppDocsStore implements AppDocsStore {

    private byApp = new Map<string, Array<AppDoc>>();

    async replaceForApp(appId : string, docs : Array<AppDoc>) : Promise<void> {
        this.byApp.set(appId, docs.map(doc => ({ ...doc })));
    }

    async listForApp(appId : string) : Promise<Array<AppDoc>> {
        return (this.byApp.get(appId) ?? []).map(doc => ({ ...doc }));
    }

}

export { InMemoryAppDocsStore }
