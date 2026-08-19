import {createServer, Server, Socket} from "node:net";

type AdminCommand = (argument : string) => string | Promise<string>;

/* The socket-level admin server baked into every app image. It listens on the
   admin port and answers newline-terminated commands, writing one line back per
   command. `ping` (answering `ok`) is built in and is what the platform probes
   and reports as the app being up; further commands are registered with
   `handle`. Kept deliberately transport-light (raw TCP, no HTTP) so an app that
   serves no web traffic still has a liveness surface. */
class AdminServer {

    private commands = new Map<string, AdminCommand>();
    private server? : Server;

    constructor(private port : number = Number(process.env.ANBARIC_ADMIN_PORT ?? 8791)) {
        this.handle("ping", () => "ok");
    }

    handle(command : string, run : AdminCommand) : this {
        this.commands.set(command, run);
        return this;
    }

    listen() : Promise<number> {
        this.server = createServer(socket => this.serve(socket));
        return new Promise(resolve => this.server!.listen(this.port, () =>
            resolve((this.server!.address() as { port : number }).port)));
    }

    async close() : Promise<void> {
        await new Promise<void>(resolve => this.server ? this.server.close(() => resolve()) : resolve());
    }

    private serve(socket : Socket) : void {
        let buffer = "";
        socket.setEncoding("utf8");
        socket.on("data", async chunk => {
            buffer += chunk;
            let newline : number;
            while ((newline = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                if (line) await this.respond(socket, line);
            }
        });
        socket.on("error", () => socket.destroy());
    }

    private async respond(socket : Socket, line : string) : Promise<void> {
        const [command, ...rest] = line.split(" ");
        const run = this.commands.get(command);
        if (!run) return void socket.write(`error unknown command "${command}"\n`);
        try {
            socket.write(`${await run(rest.join(" "))}\n`);
        } catch (error) {
            socket.write(`error ${error instanceof Error ? error.message : error}\n`);
        }
    }

}

export { AdminServer };
export type { AdminCommand };
