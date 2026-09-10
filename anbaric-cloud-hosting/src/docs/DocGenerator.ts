import {AppDoc, AppDocsStore} from "../data-store/AppDocsStore";
import {DocModel, DraftDoc} from "./DocModel";
import {gatherSources} from "./gatherSources";

const README = /^readme(\.md|\.markdown)?$/i;

/* Arranges the model's draft docs into the shallow tree the store holds: one
   "introduction" root with every other page beneath it, plus the app's README
   copied in verbatim as a second root beside the introduction. It is defensive
   about what the model returned - a missing introduction, a dangling or looping
   parent - so the stored set is always a well-formed single-rooted tree (two
   roots once the README is added). */
const buildDocTree = (drafts : Array<DraftDoc>, readme : string | undefined) : Array<AppDoc> => {
    const cleaned = drafts
        .filter(draft => draft && typeof draft.slug === "string" && draft.slug.trim() && typeof draft.markdown === "string")
        .map(draft => ({
            slug: draft.slug.trim(),
            title: (typeof draft.title === "string" && draft.title.trim() ? draft.title : draft.slug).trim(),
            markdown: draft.markdown,
            parentSlug: typeof draft.parentSlug === "string" && draft.parentSlug.trim() ? draft.parentSlug.trim() : null,
        }))
        .filter(draft => draft.slug !== "readme");

    if (cleaned.length === 0) return [];

    const bySlug = new Map(cleaned.map(draft => [draft.slug, draft]));

    const intro = bySlug.get("introduction") ?? cleaned.find(draft => draft.parentSlug === null) ?? cleaned[0];
    intro.parentSlug = null;

    const reachesIntro = (draft : typeof cleaned[number]) : boolean => {
        const seen = new Set<string>();
        let current : typeof cleaned[number] | undefined = draft;

        while (current && current !== intro) {
            if (seen.has(current.slug)) return false;
            seen.add(current.slug);
            current = current.parentSlug === null ? undefined : bySlug.get(current.parentSlug);
        }

        return current === intro;
    };

    for (const draft of cleaned) {
        if (draft !== intro && ! reachesIntro(draft)) draft.parentSlug = intro.slug;
    }

    const nextPosition = new Map<string, number>();
    const positioned = (parentSlug : string | null) : number => {
        const key = parentSlug ?? "";
        const position = nextPosition.get(key) ?? 0;
        nextPosition.set(key, position + 1);
        return position;
    };

    const docs : Array<AppDoc> = [{ ...intro, position: positioned(null) }];

    for (const draft of cleaned) {
        if (draft !== intro) docs.push({ ...draft, position: positioned(draft.parentSlug) });
    }

    if (readme !== undefined) {
        docs.push({ slug: "readme", title: "README", markdown: readme, parentSlug: null, position: positioned(null) });
    }

    return docs;
};

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

            const drafts = await this.model.writeDocs({ appName, files, truncated });
            const readme = files.find(file => README.test(file.path))?.content;
            const docs = buildDocTree(drafts, readme);
            if (docs.length === 0) return;

            await this.store.replaceForApp(appName, docs);
            console.log(`[docs] ${options.redeploy ? "regenerated" : "generated"} ${docs.length} doc(s) for "${appName}"`);
        } catch (error) {
            console.error(`[docs] could not generate documentation for "${appName}": ${error instanceof Error ? error.message : error}`);
        }
    }

}

export { DocGenerator, buildDocTree }
