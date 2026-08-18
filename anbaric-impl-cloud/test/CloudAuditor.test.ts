import {afterEach, describe, expect, it} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {CloudAuditor} from "../src/CloudAuditor";
import {AuditInteraction} from "anbaric-tsapi";
import {Code, Human} from "anbaric-state-machine";

describe("CloudAuditor", () => {

    let server : Server | undefined;

    afterEach(async () => {
        if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
        server = undefined;
    });

    const startPlatform = (received : Array<{ url? : string, body : any }>) : Promise<string> =>
        new Promise(resolve => {
            server = createServer((request, response) => {
                const chunks : Array<Buffer> = [];
                request.on("data", chunk => chunks.push(chunk));
                request.on("end", () => {
                    received.push({ url: request.url, body: JSON.parse(Buffer.concat(chunks).toString()) });
                    response.writeHead(204);
                    response.end();
                });
            });
            server.listen(0, () => resolve(`http://127.0.0.1:${(server!.address() as AddressInfo).port}`));
        });

    it("posts the audit record to the platform", async () => {
        const received : Array<{ url? : string, body : any }> = [];
        const auditor = new CloudAuditor(await startPlatform(received));

        await auditor.audit("job", "job-1", new Human("chris", "admin"), [AuditInteraction.UPDATE_PROPERTIES], "Properties updated", { age: 42 });

        expect(received).toHaveLength(1);
        expect(received[0].url).toBe("/audits");
        expect(received[0].body).toEqual({
            resourceType: "job",
            resourceId: "job-1",
            actorId: "chris",
            actorType: "HUMAN",
            interaction: ["UPDATE_PROPERTIES"],
            description: "Properties updated",
            details: { age: 42 },
        });
    });

    it("records machine-made state changes", async () => {
        const received : Array<{ url? : string, body : any }> = [];
        const auditor = new CloudAuditor(await startPlatform(received));

        await auditor.audit("job", "job-1", new Code("workflow-1", "state-machine"), [AuditInteraction.CHANGE_STATE], 'Transitioned to "done"', null);

        expect(received[0].body.actorId).toBe("workflow-1");
        expect(received[0].body.interaction).toEqual(["CHANGE_STATE"]);
        expect(received[0].body.details).toBeNull();
    });

});
