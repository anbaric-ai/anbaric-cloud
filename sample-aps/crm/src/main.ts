import {createServer, IncomingMessage, ServerResponse} from "node:http";
import {serializeJob} from "anbaric-tsapi";
import {JobPersistenceFactory, QueueFactory} from "anbaric-state-machine";
import {customerWorkflow} from "./customerWorkflow";

const persistence = JobPersistenceFactory.instance();
const queue = QueueFactory.instance();
const customers = customerWorkflow(persistence, queue);

const readBody = (request : IncomingMessage) : Promise<any> =>
    new Promise((resolve, reject) => {
        const chunks : Array<Buffer> = [];
        request.on("data", chunk => chunks.push(chunk));
        request.on("error", reject);
        request.on("end", () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
            } catch (error) {
                reject(error);
            }
        });
    });

const reply = (response : ServerResponse, status : number, body : unknown) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
};

const server = createServer((request, response) => {
    handle(request, response).catch(error =>
        reply(response, 500, { error: error instanceof Error ? error.message : "Internal error" }));
});

const handle = async (request : IncomingMessage, response : ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const [resource, id] = url.pathname.split("/").filter(Boolean);

    if (resource !== "customers") return reply(response, 404, { error: "Not found" });

    if (request.method === "POST" && !id) {
        const { name, email } = await readBody(request);
        const job = await customers.startJob(new Map(Object.entries({ name, email })));
        return reply(response, 201, serializeJob(job));
    }

    if (request.method === "GET" && !id) {
        return reply(response, 200, (await persistence.list()).map(serializeJob));
    }

    if (request.method === "GET" && id) {
        return reply(response, 200, serializeJob(await persistence.retrieve(id)));
    }

    reply(response, 404, { error: "Not found" });
};

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`crm listening on port ${port}`));
