import {spawn} from "node:child_process";

const openBrowser = (url : string) : void => {
    const command = process.platform === "darwin" ? "open"
        : process.platform === "win32" ? "start"
        : "xdg-open";

    const child = spawn(command, [url], { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
};

export { openBrowser }
