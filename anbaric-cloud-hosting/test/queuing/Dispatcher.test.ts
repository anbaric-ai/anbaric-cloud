import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {QueueMessage} from "anbaric-tsapi";
import {InMemoryQueue} from "anbaric-state-machine";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";
import {ConsumerRegistry} from "../../src/queuing/ConsumerRegistry";
import {Dispatcher} from "../../src/queuing/Dispatcher";

const DISPATCH_INTERVAL_MS = 10;

// A confirmable queue — like the platform's PostgresQueue — that hands each
// message out once and records what the dispatcher confirms or cancels.
class TestQueue extends InMemoryQueue implements RemoteQueue {

    confirmed : Array<QueueMessage> = [];
    cancelled : Array<QueueMessage> = [];
    debounced : Array<QueueMessage> = [];

    async confirm(message : QueueMessage) : Promise<void> {
        this.confirmed.push(message);
    }

    async debounce(message : QueueMessage) : Promise<void> {
        this.debounced.push(message);
    }

    async cancel(message : QueueMessage) : Promise<void> {
        this.cancelled.push(message);
    }

    async size() : Promise<number> {
        return 0;
    }

}

const startStubConsumer = (received : Array<Array<QueueMessage>>, alwaysFails : boolean = false, rejects : Array<string> = []) :
    Promise<{ server : Server, url : string }> =>
    new Promise(resolve => {
        const server = createServer((request, response) => {
            const chunks : Array<Buffer> = [];
            request.on("data", chunk => chunks.push(chunk));
            request.on("end", () => {
                if (alwaysFails) {
                    response.statusCode = 500;
                    response.end();
                    return;
                }
                const messages = JSON.parse(Buffer.concat(chunks).toString()).messages as Array<QueueMessage>;
                received.push(messages);
                response.statusCode = 202;
                response.setHeader("content-type", "application/json");
                response.end(JSON.stringify({
                    accepted: messages.filter(message => ! rejects.includes(message.jobId)).map(message => message.jobId),
                    rejected: messages.filter(message => rejects.includes(message.jobId)).map(message => message.jobId),
                }));
            });
        });
        server.listen(0, () => resolve({
            server,
            url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        }));
    });

describe("Dispatcher", () => {

    let queue : TestQueue;
    let registry : ConsumerRegistry;
    let dispatcher : Dispatcher;
    let stubServers : Array<Server>;
    let rejected : Array<QueueMessage>;

    beforeEach(() => {
        queue = new TestQueue();
        registry = new ConsumerRegistry();
        rejected = [];
        dispatcher = new Dispatcher(queue, async (appId, workflowId) => registry.lookup(appId, workflowId), DISPATCH_INTERVAL_MS,
            async message => { rejected.push(message); });
        stubServers = [];
    });

    afterEach(async () => {
        await dispatcher.cleanUp();
        for (const server of stubServers) {
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });

    const registeredConsumer = async (workflowId : string, alwaysFails : boolean = false, rejects : Array<string> = []) => {
        const received : Array<Array<QueueMessage>> = [];
        const stub = await startStubConsumer(received, alwaysFails, rejects);
        stubServers.push(stub.server);
        registry.register(undefined, workflowId, stub.url);
        return received;
    };

    it("pushes dequeued messages to the registered consumer as a batch", async () => {
        const received = await registeredConsumer("workflow-1");
        await queue.enqueue("job-1", undefined, "workflow-1");
        await queue.enqueue("job-2", undefined, "workflow-1");

        dispatcher.start();

        await vi.waitFor(() => expect(received.flat()).toEqual([
            { jobId: "job-1", workflowId: "workflow-1" },
            { jobId: "job-2", workflowId: "workflow-1" },
        ]));
    });

    it("routes messages to the consumer registered for their workflow", async () => {
        const first = await registeredConsumer("workflow-1");
        const second = await registeredConsumer("workflow-2");
        await queue.enqueue("job-1", undefined, "workflow-1");
        await queue.enqueue("job-2", undefined, "workflow-2");

        dispatcher.start();

        await vi.waitFor(() => {
            expect(first.flat()).toEqual([{ jobId: "job-1", workflowId: "workflow-1" }]);
            expect(second.flat()).toEqual([{ jobId: "job-2", workflowId: "workflow-2" }]);
        });
    });

    it("debounces a message that has no registered consumer", async () => {
        await queue.enqueue("orphan", undefined, "workflow-none");

        dispatcher.start();

        await vi.waitFor(() => expect(queue.debounced).toContainEqual(
            { jobId: "orphan", workflowId: "workflow-none" },
        ));
        expect(queue.cancelled).toEqual([]);
    });

    it("leaves a message whose push fails in the queue — it neither cancels, confirms nor debounces it", async () => {
        await registeredConsumer("workflow-1", true);
        await queue.enqueue("job-1", undefined, "workflow-1");

        dispatcher.start();
        await new Promise(resolve => setTimeout(resolve, DISPATCH_INTERVAL_MS * 5));

        expect(queue.cancelled).toEqual([]);
        expect(queue.confirmed).toEqual([]);
        expect(queue.debounced).toEqual([]);
    });

    it("hands the messages a consumer rejects to the rejection handler, and only those", async () => {
        await registeredConsumer("workflow-1", false, ["job-2"]);
        await queue.enqueue("job-1", undefined, "workflow-1");
        await queue.enqueue("job-2", undefined, "workflow-1");

        dispatcher.start();

        await vi.waitFor(() => expect(rejected).toEqual([{ jobId: "job-2", workflowId: "workflow-1" }]));
        expect(queue.debounced).toEqual([]);
    });

    it("dispatches nothing after cleanUp", async () => {
        const received = await registeredConsumer("workflow-1");
        dispatcher.start();
        await dispatcher.cleanUp();

        await queue.enqueue("job-1", undefined, "workflow-1");
        await new Promise(resolve => setTimeout(resolve, DISPATCH_INTERVAL_MS * 5));

        expect(received).toEqual([]);
    });

});
