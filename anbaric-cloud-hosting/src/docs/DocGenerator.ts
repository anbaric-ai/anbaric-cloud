import {AppDocsStore} from "../data-store/AppDocsStore";
import {DocModel} from "./DocModel";
import {gatherSources} from "./gatherSources";

/* Generates an app's user documentation from its source and stores it. It runs
   off the deploy's critical path (the build layer calls it fire-and-forget), so
   it is deliberately all-or-nothing and never throws: any failure - no model
   configured, a slow or erroring model, unreadable source - is logged and the
   existing docs are left as they are. */
class DocGenerator {

    constructor(private model : DocModel, private store : AppDocsStore) {}

    async generate(appName : string, appDir : string, options : { redeploy : boolean }) : Promise<void> {
        try {
            const { files, truncated } = await gatherSources(appDir);
            if (files.length === 0) return;

            const docs = await this.model.writeDocs({ appName, files, truncated });
            if (docs.length === 0) return;

            await this.store.replaceForApp(appName, docs);
            console.log(`[docs] ${options.redeploy ? "regenerated" : "generated"} ${docs.length} doc(s) for "${appName}"`);
        } catch (error) {
            console.error(`[docs] could not generate documentation for "${appName}": ${error instanceof Error ? error.message : error}`);
        }
    }

}

export { DocGenerator }
