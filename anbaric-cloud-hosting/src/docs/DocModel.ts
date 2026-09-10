type DocContext = {
    appName : string,
    files : Array<{ path : string, content : string }>,
    truncated : boolean,
};

/* One doc as the model proposes it, before the generator arranges the set into
   a tree: a slug, a title, its markdown, and optionally the slug of the doc it
   belongs under (the introduction, or another page). The generator fills in the
   final parent and sibling position. */
type DraftDoc = {
    slug : string,
    title : string,
    markdown : string,
    parentSlug? : string | null,
};

/* Turns an app's source into a set of user-facing docs. An implementation that
   cannot reach a model (nothing configured) returns an empty set rather than
   throwing, so doc generation quietly does nothing. */
interface DocModel {

    writeDocs(context : DocContext) : Promise<Array<DraftDoc>>;

}

export type { DocContext, DraftDoc, DocModel };
