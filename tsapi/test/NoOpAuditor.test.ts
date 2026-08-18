import {describe, expect, it} from "vitest";
import {Actor} from "../src/api/actors/Actor";
import {AuditInteraction} from "../src/api/auditing/Auditor";
import {NoOpAuditor} from "../src/api/auditing/NoOpAuditor";

const actor : Actor = { type: "CODE", id: "sys", role: "code" };

describe("NoOpAuditor", () => {

    it("records nothing and resolves", async () => {
        await expect(new NoOpAuditor().audit("job", "job-1", actor, [AuditInteraction.READ], "", null)).resolves.toBeUndefined();
    });

});
