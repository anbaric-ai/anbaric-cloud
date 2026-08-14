import {cyan, dim} from "./Ansi";

const WAVE_WIDTH = 20;
const FIELD = "░";
const CREST = ["▒", "▓", "█"];

const centerAt = (tick : number) : number => {
    const period = 2 * (WAVE_WIDTH - 1);
    const phase = tick % period;
    return phase < WAVE_WIDTH ? phase : period - phase;
};

const waveFrame = (tick : number) : string => {
    const center = centerAt(tick);

    return Array.from({ length: WAVE_WIDTH }, (_, position) => {
        const distance = Math.abs(position - center);
        return distance < CREST.length
            ? cyan(CREST[CREST.length - 1 - distance])
            : dim(FIELD);
    }).join("");
};

export { waveFrame, WAVE_WIDTH }
