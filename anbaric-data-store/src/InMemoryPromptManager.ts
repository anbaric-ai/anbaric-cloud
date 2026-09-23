import {currentAppId, JsonSchema, Prompt, PromptManager, samePromptContent} from "anbaric-tsapi";

class InMemoryPromptManager implements PromptManager {

    private versions = new Map<string, Array<Prompt>>();

    constructor(private appId : string = currentAppId()) {}

    async save(promptId : string, instructions : string, outputSchema? : JsonSchema) : Promise<Prompt> {
        const history = this.versions.get(promptId) ?? [];
        const latest = history[history.length - 1];
        if (latest && samePromptContent(latest, instructions, outputSchema)) return this.copy(latest);

        const prompt : Prompt = {
            appId: this.appId,
            promptId,
            version: (latest?.version ?? 0) + 1,
            instructions,
            outputSchema: this.copySchema(outputSchema),
            createdAt: new Date().toISOString(),
        };
        history.push(prompt);
        this.versions.set(promptId, history);
        return this.copy(prompt);
    }

    async retrieve(promptId : string, version? : number) : Promise<Prompt> {
        const history = this.versions.get(promptId) ?? [];
        const found = version === undefined ? history[history.length - 1] : history.find(prompt => prompt.version === version);
        if (! found) {
            throw new Error(version === undefined
                ? `No prompt found with id "${promptId}"`
                : `No prompt found with id "${promptId}" at version ${version}`);
        }
        return this.copy(found);
    }

    async list() : Promise<Array<Prompt>> {
        return Array.from(this.versions.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([, history]) => this.copy(history[history.length - 1]));
    }

    async history(promptId : string) : Promise<Array<Prompt>> {
        return (this.versions.get(promptId) ?? []).map(prompt => this.copy(prompt)).reverse();
    }

    private copy(prompt : Prompt) : Prompt {
        return { ...prompt, outputSchema: this.copySchema(prompt.outputSchema) };
    }

    private copySchema(schema? : JsonSchema) : JsonSchema | undefined {
        return schema === undefined ? undefined : JSON.parse(JSON.stringify(schema));
    }

}

export { InMemoryPromptManager }
