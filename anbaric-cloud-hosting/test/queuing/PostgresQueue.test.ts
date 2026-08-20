import {describe, expect, it, vi} from "vitest";
import {Pool} from "pg";
import {PostgresQueue} from "../../src/queuing/PostgresQueue";

const mockPool = () => {
    const query = vi.fn(async (_sql : string, _params? : Array<any>) => ({ rows: [] as Array<any> }));
    return { pool: { query } as unknown as Pool, query };
};

describe("PostgresQueue", () => {

    it("carries each dequeued row's position", async () => {
        const { pool, query } = mockPool();
        query.mockResolvedValueOnce({ rows: [{ job_id: "job-1", workflow_id: "wf-1", due: null, position: "5" }] });

        expect(await new PostgresQueue(pool).dequeueSome()).toEqual([
            { jobId: "job-1", workflowId: "wf-1", position: 5 },
        ]);
    });

    it("confirms a message by its unique position", async () => {
        const { pool, query } = mockPool();

        await new PostgresQueue(pool).confirm({ jobId: "job-1", workflowId: "wf-1", position: 42 });

        expect(query).toHaveBeenCalledWith("DELETE FROM queue WHERE position = $1", [42]);
    });

    it("never keys the confirm on the job, so a job's other queued messages survive", async () => {
        const { pool, query } = mockPool();

        await new PostgresQueue(pool).confirm({ jobId: "job-1", workflowId: "wf-1", position: 7 });

        const [sql] = query.mock.calls[0];
        expect(sql).not.toContain("job_id");
        expect(sql).not.toContain("workflow_id");
    });

    it("skips the delete when a message carries no position", async () => {
        const { pool, query } = mockPool();

        await new PostgresQueue(pool).confirm({ jobId: "job-1", workflowId: "wf-1" });

        expect(query).not.toHaveBeenCalled();
    });

});
