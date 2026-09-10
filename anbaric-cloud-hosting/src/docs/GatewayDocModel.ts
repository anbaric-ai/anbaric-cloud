import {AppDoc} from "../data-store/AppDocsStore";
import {DocContext, DocModel} from "./DocModel";

type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

const SYSTEM_PROMPT = `You write user documentation for an application deployed on Anbaric.

Anbaric apps model their domain as state machines: long-lived jobs move through named states, driven by actions and transitions, with data validated against a schema and every change attributed to an actor. Read the whole source you are given and write documentation for the people who will USE this app - what it does, the workflows it runs, how someone drives it, and anything they need to know. Write clear markdown. Prefer several focused docs over one long one; give each a short kebab-case slug and a human title. Do not invent features the source does not show. If the source was truncated, document only what you can see.`;

const OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        docs: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    slug: { type: "string" },
                    title: { type: "string" },
                    markdown: { type: "string" },
                },
                required: ["slug", "title", "markdown"],
            },
        },
    },
    required: ["docs"],
};

/* The platform's doc writer over an OpenAI-compatible chat endpoint - the same
   gateway the agentic actions use (ANBARIC_AI_GATEWAY_*), so no new config.
   With no token there is nothing to call, so it returns no docs and the
   generator does nothing. */
class GatewayDocModel implements DocModel {

    constructor(private baseUrl : string = process.env.ANBARIC_AI_GATEWAY_URL ?? "https://api.openai.com/v1",
                private apiKey : string = process.env.ANBARIC_AI_GATEWAY_TOKEN ?? "",
                private model : string = process.env.ANBARIC_AGENTIC_MODEL ?? "gpt-5.4-mini",
                private fetchFn : FetchFn = (url, init) => fetch(url, init)) {}

    async writeDocs(context : DocContext) : Promise<Array<AppDoc>> {
        if (!this.apiKey) {
            console.warn(`[docs] no ANBARIC_AI_GATEWAY_TOKEN - skipping documentation for "${context.appName}"`);
            return [];
        }

        const response = await this.fetchFn(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: { "content-type": "application/json", "authorization": `Bearer ${this.apiKey}` },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: this.render(context) },
                ],
                response_format: {
                    type: "json_schema",
                    json_schema: { name: "docs", strict: true, schema: OUTPUT_SCHEMA },
                },
            }),
        });

        if (!response.ok) {
            const problem = await response.json().catch(() => ({}));
            throw new Error(`Doc model request failed with status ${response.status}${problem.error?.message ? `: ${problem.error.message}` : ""}`);
        }

        const message = (await response.json()).choices?.[0]?.message?.content;
        const docs = message ? JSON.parse(message).docs : [];
        return Array.isArray(docs) ? docs : [];
    }

    private render(context : DocContext) : string {
        const header = `App "${context.appName}"${context.truncated ? " (source was truncated - some files are omitted)" : ""}. Source:`;
        const files = context.files.map(file => `\n\n=== ${file.path} ===\n${file.content}`).join("");
        return header + files;
    }

}

export { GatewayDocModel }
