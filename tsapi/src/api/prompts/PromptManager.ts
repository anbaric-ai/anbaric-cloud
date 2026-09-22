import {JsonSchema} from "../documents/JsonSchema.js";

/* One version of a prompt: the instructions a model is given, and optionally
   the shape of what it is given and what it must produce. */
type Prompt = {

    appId : string,
    promptId : string,
    version : number,
    instructions : string,
    inputSchema? : JsonSchema,
    outputSchema? : JsonSchema,
    createdAt : string,

};

/* Versioned prompts owned by the calling app. Saving stores a new version -
   unless nothing changed, in which case the current version is returned -
   and a prompt is fetched at its latest version unless one is named. There
   is no rollback and no tagging: an app always gets the latest. */
interface PromptManager {

    save(promptId : string, instructions : string, inputSchema? : JsonSchema, outputSchema? : JsonSchema) : Promise<Prompt>;

    retrieve(promptId : string, version? : number) : Promise<Prompt>;

    list() : Promise<Array<Prompt>>;

    history(promptId : string) : Promise<Array<Prompt>>;

}

const stable = (value : any) : string => {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
};

/* Whether a prompt's content would be unchanged by a save - the check that
   keeps a start-up registration from minting a new version every run. */
const samePromptContent = (existing : Pick<Prompt, "instructions" | "inputSchema" | "outputSchema">,
                           instructions : string, inputSchema? : JsonSchema, outputSchema? : JsonSchema) : boolean =>
    existing.instructions === instructions &&
    stable(existing.inputSchema ?? null) === stable(inputSchema ?? null) &&
    stable(existing.outputSchema ?? null) === stable(outputSchema ?? null);

export { samePromptContent };
export type { Prompt, PromptManager };
