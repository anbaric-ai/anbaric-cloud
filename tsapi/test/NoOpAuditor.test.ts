import {describe, expect, it} from "vitest";
import {Actor} from "../src/api/actors/Actor";
import {NoOpAuditor} from "../src/api/auditing/NoOpAuditor";

const actor : Actor = { type: "CODE", id: "sys", roles: ["code"] };

describe("NoOpAuditor", () => {

    it("records nothing and resolves", async () => {
        await expect(new NoOpAuditor().audit("job", "job-1", actor, ["READ"], "", null)).resolves.toBeUndefined();
    });

});
