import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {QueueMessage} from "anbaric-tsapi";
import {InMemoryQueue} from "anbaric-state-machine";
import {ConsumerRegistry} from "../../src/queuing/ConsumerRegistry";
import {Dispatcher} from "../../src/queuing/Dispatcher";

const DISPATCH_INTERVAL_MS = 10;

const startStubConsumer = (received : Array<Array<QueueMessage>>, failFirstRequests : number = 0) :
    Promise<{ server : Server, url : string }> =>
    new Promise(resolve => {
        let requestCount = 0;
        const server = createServer((request, response) => {
            const chunks : Array<Buffer> = [];
            request.on("data", chunk => chunks.push(chunk));
            request.on("end", () => {
                requestCount++;
                if (requestCount <= failFirstRequests) {
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

    let queue : InMemoryQueue;
    let registry : ConsumerRegistry;
    let dispatcher : Dispatcher;
    let stubServers : Array<Server>;

    beforeEach(() => {
        queue = new InMemoryQueue();
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

    const registeredConsumer = async (workflowId : string, failFirstRequests : number = 0) => {
        const received : Array<Array<QueueMessage>> = [];
        const stub = await startStubConsumer(received, failFirstRequests);
        stubServers.push(stub.server);
        registry.register(workflowId, stub.url);
        return received;
    };

    it("pushes dequeued messages to the registered consumer as a batch", async () => {
        const received = await registeredConsumer("workflow-1");
        await queue.enqueue("job-1", "workflow-1");
        await queue.enqueue("job-2", "workflow-1");

        dispatcher.start();

        await vi.waitFor(() => expect(received.flat()).toEqual([
            { jobId: "job-1", workflowId: "workflow-1" },
            { jobId: "job-2", workflowId: "workflow-1" },
        ]));
    });

    it("routes messages to the consumer registered for their workflow", async () => {
        const first = await registeredConsumer("workflow-1");
        const second = await registeredConsumer("workflow-2");
        await queue.enqueue("job-1", "workflow-1");
        await queue.enqueue("job-2", "workflow-2");

        dispatcher.start();

        await vi.waitFor(() => {
            expect(first.flat()).toEqual([{ jobId: "job-1", workflowId: "workflow-1" }]);
            expect(second.flat()).toEqual([{ jobId: "job-2", workflowId: "workflow-2" }]);
        });
    });

    it("keeps unroutable messages until their consumer registers", async () => {
        await queue.enqueue("job-1", "workflow-later");
        dispatcher.start();

        await new Promise(resolve => setTimeout(resolve, DISPATCH_INTERVAL_MS * 5));
        const received = await registeredConsumer("workflow-later");

        await vi.waitFor(() => expect(received.flat()).toEqual([
            { jobId: "job-1", workflowId: "workflow-later" },
        ]));
    });

    it("re-enqueues and retries a batch whose push fails", async () => {
        const received = await registeredConsumer("workflow-1", 1);
        await queue.enqueue("job-1", "workflow-1");

        dispatcher.start();

        await vi.waitFor(() => expect(received.flat()).toEqual([
            { jobId: "job-1", workflowId: "workflow-1" },
        ]));
    });

    it("dispatches nothing after cleanUp", async () => {
        const received = await registeredConsumer("workflow-1");
        dispatcher.start();
        await dispatcher.cleanUp();

        await queue.enqueue("job-1", "workflow-1");
        await new Promise(resolve => setTimeout(resolve, DISPATCH_INTERVAL_MS * 5));

        expect(received).toEqual([]);
    });

});
