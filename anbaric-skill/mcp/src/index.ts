import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {CallToolRequestSchema, ListToolsRequestSchema} from "@modelcontextprotocol/sdk/types.js";
import {tools} from "./tools";

const server = new Server(
    { name: "anbaric", version: "1.21.5" },
    { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
    })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(candidate => candidate.name === request.params.name);
    if (!tool) throw new Error(`No such tool "${request.params.name}"`);

    try {
        const result = await tool.run(request.params.arguments ?? {});
        return { content: [{ type: "text", text: JSON.stringify(result ?? null, null, 2) }] };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: message }], isError: true };
    }
});

const main = async () => {
    await server.connect(new StdioServerTransport());
};

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
