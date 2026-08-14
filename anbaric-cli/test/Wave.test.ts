import {describe, expect, it} from "vitest";
import {waveFrame, WAVE_WIDTH} from "../src/ui/Wave";

describe("waveFrame", () => {

    it("renders the full crest sequence around the wave's center", () => {
        expect(waveFrame(3)).toBe("░▒▓█▓▒░░░░░░░░░░░░░░");
    });

    it("is always exactly the wave width", () => {
        for (let tick = 0; tick < 100; tick++) {
            expect(waveFrame(tick)).toHaveLength(WAVE_WIDTH);
        }
    });

    it("clips the crest at the left edge", () => {
        expect(waveFrame(0)).toBe("█▓▒░░░░░░░░░░░░░░░░░");
    });

    it("reaches the right edge before bouncing", () => {
        expect(waveFrame(WAVE_WIDTH - 1)).toBe("░░░░░░░░░░░░░░░░░▒▓█");
    });

    it("travels back down the row after bouncing", () => {
        expect(waveFrame(WAVE_WIDTH)).toBe("░░░░░░░░░░░░░░░░▒▓█▓");
    });

    it("returns to the start after a full round trip", () => {
        expect(waveFrame(2 * (WAVE_WIDTH - 1))).toBe(waveFrame(0));
    });

});
