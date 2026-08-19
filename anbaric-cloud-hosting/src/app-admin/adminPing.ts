import {connect} from "node:net";

/* Opens an app's admin port, sends `ping`, and resolves true when it answers
   `ok` within the timeout - false on any timeout, refusal or other error. Used
   both by the liveness probe and by on-demand status reporting. */
const adminPing = (host : string, port : number, timeoutMs : number = 1000) : Promise<boolean> =>
    new Promise(resolve => {
        const socket = connect({ host, port });
        let answered = "";
        const done = (result : boolean) => { socket.destroy(); resolve(result); };
        socket.setTimeout(timeoutMs, () => done(false));
        socket.setEncoding("utf8");
        socket.on("connect", () => socket.write("ping\n"));
        socket.on("data", chunk => {
            answered += chunk;
            if (answered.includes("\n")) done(answered.trim().startsWith("ok"));
        });
        socket.on("error", () => done(false));
    });

export { adminPing };
