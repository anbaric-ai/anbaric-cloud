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

    async confirm(message : QueueMessage) : Promise<void> {
        this.confirmed.push(message);
    }

    async cancel(message : QueueMessage) : Promise<void> {
        this.cancelled.push(message);
    }

    async size() : Promise<number> {
        return 0;
    }

}

const startStubConsumer = (received : Array<Array<QueueMessage>>, alwaysFails : boolean = false) :
    Promise<{ server : Server, url : string }> =>
    new Promise(resolve => {
        const server = createServer((request, response) => {
            const chunks : Array<Buffer> = [];
            request.on("data", chunk => chunks.push(chunk));
            request.on("end", () => {
                if (alwaysFails) {
                    response.statusCode = 500;
                } else {
                    received.push(JSON.parse(Buffer.concat(chunks).toString()).messages);
                    response.statusCode = 202;
                }
                response.end();
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

    beforeEach(() => {
        queue = new TestQueue();
        registry = new ConsumerRegistry();
        dispatcher = new Dispatcher(queue, registry, DISPATCH_INTERVAL_MS);
        stubServers = [];
    });

    afterEach(async () => {
        await dispatcher.cleanUp();
        for (const server of stubServers) {
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });

    const registeredConsumer = async (workflowId : string, alwaysFails : boolean = false) => {
        const received : Array<Array<QueueMessage>> = [];
        const stub = await startStubConsumer(received, alwaysFails);
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

    it("cancels a message that has no registered consumer", async () => {
        await queue.enqueue("orphan", undefined, "workflow-none");

        dispatcher.start();

        await vi.waitFor(() => expect(queue.cancelled).toEqual([
            { jobId: "orphan", workflowId: "workflow-none" },
        ]));
    });

    it("leaves a message whose push fails in the queue — it neither cancels nor confirms it", async () => {
        await registeredConsumer("workflow-1", true);
        await queue.enqueue("job-1", undefined, "workflow-1");

        dispatcher.start();
        await new Promise(resolve => setTimeout(resolve, DISPATCH_INTERVAL_MS * 5));

        expect(queue.cancelled).toEqual([]);
        expect(queue.confirmed).toEqual([]);
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
