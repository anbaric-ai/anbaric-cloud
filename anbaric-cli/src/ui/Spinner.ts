import {waveFrame} from "./Wave";

const FRAME_INTERVAL_MS = 80;

class Spinner {

    private tick = 0;
    private ticker? : NodeJS.Timeout;

    constructor(private message : string) {}

    start() : Spinner {
        if (!process.stdout.isTTY) {
            console.log(this.message);
            return this;
        }
        this.ticker = setInterval(() => {
            process.stdout.write(`\r\x1b[2K${waveFrame(this.tick++)} ${this.message}`);
        }, FRAME_INTERVAL_MS);
        return this;
    }

    update(message : string) : void {
        this.message = message;
    }

    stop(finalLine? : string) : void {
        if (this.ticker) clearInterval(this.ticker);
        this.ticker = undefined;
        if (process.stdout.isTTY) process.stdout.write("\r\x1b[2K");
        if (finalLine) console.log(finalLine);
    }

}

export { Spinner }
