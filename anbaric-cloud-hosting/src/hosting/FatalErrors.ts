type Exit = (code : number) => void;
type Log = (line : string) => void;

/* The platform's last words. An error nobody caught ends the process - Node
   gives no choice there - but it should end it saying what happened, in one
   line a log search can find, rather than a stack trace that only a person
   reading the stream would notice. ECS restarts the task either way; this is
   what makes the restart explicable afterwards. */
class FatalErrors {

    constructor(private log : Log = line => console.error(line), private exit : Exit = code => process.exit(code)) {}

    install(target : NodeJS.Process = process) : void {
        target.on("uncaughtException", error => this.die("uncaughtException", error));
        target.on("unhandledRejection", reason => this.die("unhandledRejection", reason));
        target.on("SIGTERM", () => this.log(this.line("platform.stopping", { signal: "SIGTERM" })));
    }

    private die(kind : string, error : unknown) : void {
        const detail = error instanceof Error
            ? { message: error.message, name: error.name, code: (error as { code? : string }).code, stack: error.stack }
            : { message: String(error) };
        this.log(this.line("platform.crash", { kind, ...detail }));
        this.exit(1);
    }

    private line(event : string, fields : Record<string, unknown>) : string {
        return JSON.stringify({ level: "fatal", event, at: new Date().toISOString(), ...fields });
    }

}

export { FatalErrors };
