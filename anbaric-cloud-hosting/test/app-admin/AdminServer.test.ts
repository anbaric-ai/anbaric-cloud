import {afterEach, describe, expect, it} from "vitest";
import {connect} from "node:net";
import {AdminServer} from "../../src/app-admin/AdminServer";
import {adminPing} from "../../src/app-admin/adminPing";

const sendLine = (port : number, line : string) : Promise<string> => new Promise((resolve, reject) => {
    const socket = connect({ host: "127.0.0.1", port });
    let data = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(`${line}\n`));
    socket.on("data", chunk => {
        data += chunk;
        if (data.includes("\n")) { socket.destroy(); resolve(data.trim()); }
    });
    socket.on("error", reject);
});

describe("AdminServer and adminPing", () => {

    let server : AdminServer | undefined;

    afterEach(async () => { await server?.close(); server = undefined; });

    it("answers ping with ok, so adminPing reports the app up", async () => {
        server = new AdminServer(0);
        const port = await server.listen();

        expect(await adminPing("127.0.0.1", port)).toBe(true);
    });

    it("runs registered commands and rejects unknown ones", async () => {
        server = new AdminServer(0).handle("echo", argument => `you said ${argument}`);
        const port = await server.listen();

        expect(await sendLine(port, "echo hello there")).toBe("you said hello there");
        expect(await sendLine(port, "mystery")).toContain(`unknown command "mystery"`);
    });

    it("adminPing reports down when nothing answers", async () => {
        expect(await adminPing("127.0.0.1", 1, 200)).toBe(false);
    });

});
