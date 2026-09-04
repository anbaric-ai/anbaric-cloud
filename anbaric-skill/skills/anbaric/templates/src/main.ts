import {createServer, IncomingMessage, ServerResponse} from "node:http";
import {Code, JobPersistenceFactory, QueueFactory, serializeJob} from "anbaric";
import {itemsMachine} from "./machine.js";

// Construct the stores once and wire the machine(s). Locally these are
// in-memory; deployed, the platform swaps them for cloud-backed ones.
const persistence = JobPersistenceFactory.instance();
const queue = QueueFactory.instance();
const items = itemsMachine(persistence, queue);
const appActor = new Code("app");

const readJson = (request : IncomingMessage) : Promise<any> =>
    new Promise((resolve, reject) => {
        const chunks : Array<Buffer> = [];
        request.on("data", (chunk) => chunks.push(chunk));
        request.on("error", reject);
        request.on("end", () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); }
            catch (error) { reject(error); }
        });
    });

const server = createServer((request, response) => {
    handle(request, response).catch((error) => {
        response.writeHead(500, {"content-type": "application/json"});
        response.end(JSON.stringify({error: error instanceof Error ? error.message : "Internal error"}));
    });
});

// TODO: replace these routes with your app's. This scaffold starts and lists jobs.
const handle = async (request : IncomingMessage, response : ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "POST" && url.pathname === "/items") {
        const body = await readJson(request);
        const job = await items.startJob(new Map(Object.entries(body)));
        response.writeHead(201, {"content-type": "application/json"});
        return response.end(JSON.stringify(serializeJob(job)));
    }

    if (request.method === "GET" && url.pathname === "/items") {
        const jobs = (await persistence.list(appActor)).map(serializeJob);
        response.writeHead(200, {"content-type": "application/json"});
        return response.end(JSON.stringify(jobs));
    }

    response.writeHead(200, {"content-type": "text/plain"}).end("ok");
};

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`app listening on ${port}`));
