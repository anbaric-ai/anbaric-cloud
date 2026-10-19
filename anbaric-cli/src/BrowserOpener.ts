import {spawn} from "node:child_process";

/* Opens a URL in the person's browser, through whatever the operating system
   provides for it, and never fails loudly: the caller shows the URL as well.
   On Windows "start" is a command of the shell rather than a program, so it
   is reached through the shell, with an empty title first because start takes
   its first quoted argument as a window title. */
const openBrowser = (url : string) : void => {
    const [command, args] = process.platform === "darwin" ? ["open", [url]]
        : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];

    const child = spawn(command, args, { stdio: "ignore", detached: true, windowsHide: true });
    child.on("error", () => {});
    child.unref();
};

export { openBrowser }
