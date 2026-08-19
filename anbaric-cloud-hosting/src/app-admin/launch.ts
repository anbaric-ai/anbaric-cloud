import {spawn} from "node:child_process";
import {AdminServer} from "./AdminServer";

/* The entry point every deployed app image runs (its Dockerfile CMD). It starts
   the built-in admin server - a separate concern from the app itself: liveness
   now, more later - and then runs the app as its own child process. The
   container's lifecycle follows the app's: when the app exits, so does this
   launcher (and the admin port with it), so a failed app is a failed container
   and its admin port stops answering `ping`. */
const TSX = process.env.ANBARIC_TSX_BIN ?? "/anbaric/node_modules/.bin/tsx";

const main = async () => {
    const entryPoint = process.argv[2];
    if (!entryPoint) throw new Error("Expected the app entry point as the first argument");

    const admin = new AdminServer();
    const port = await admin.listen();
    console.log(`[anbaric-admin] listening on ${port}`);

    const app = spawn(TSX, [entryPoint], { stdio: "inherit" });

    const shutdown = (signal : NodeJS.Signals) => app.kill(signal);
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    app.on("error", error => {
        console.error(`[anbaric-admin] failed to start the app: ${error.message}`);
        admin.close().finally(() => process.exit(1));
    });
    app.on("exit", (code, signal) => {
        admin.close().finally(() => process.exit(code ?? (signal ? 1 : 0)));
    });
};

main().catch(error => {
    console.error(`[anbaric-admin] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
});
