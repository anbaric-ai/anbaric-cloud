import {AppDoc} from "../data-store/AppDocsStore";

type DocContext = {
    appName : string,
    files : Array<{ path : string, content : string }>,
    truncated : boolean,
};

/* Turns an app's source into a set of user-facing docs. An implementation that
   cannot reach a model (nothing configured) returns an empty set rather than
   throwing, so doc generation quietly does nothing. */
interface DocModel {

    writeDocs(context : DocContext) : Promise<Array<AppDoc>>;

}

export type { DocContext, DocModel };
