import {bold, cyan, dim} from "./Ansi";

type SelectOption = {
    label : string,
    value? : string,
    hint? : string,
    editable? : boolean,
};

type SelectState = {
    options : Array<SelectOption>,
    highlighted : number,
    typed : string,
};

type SelectOutcome = {
    state : SelectState,
    chosen? : string,
};

const UP = "\x1b[A";
const DOWN = "\x1b[B";
const ENTER = "\r";
const BACKSPACE = "\x7f";

const chosenValue = (state : SelectState) : string | undefined => {
    const option = state.options[state.highlighted];
    return option.editable ? (state.typed || undefined) : option.value;
};

const reduceSelection = (state : SelectState, input : string) : SelectOutcome => {
    const optionCount = state.options.length;

    if (input === UP) return { state: { ...state, highlighted: (state.highlighted + optionCount - 1) % optionCount } };
    if (input === DOWN) return { state: { ...state, highlighted: (state.highlighted + 1) % optionCount } };
    if (input === ENTER || input === "\n") {
        const value = chosenValue(state);
        return value === undefined ? { state } : { state, chosen: value };
    }

    if (!state.options[state.highlighted].editable) return { state };
    if (input === BACKSPACE) return { state: { ...state, typed: state.typed.slice(0, -1) } };
    if (input.length === 1 && input >= " " && input <= "~") return { state: { ...state, typed: state.typed + input } };

    return { state };
};

const renderSelection = (state : SelectState) : string =>
    state.options.map((option, index) => {
        const highlighted = index === state.highlighted;
        const marker = highlighted ? cyan("❯") : " ";
        const label = option.editable
            ? `${option.label} ${state.typed || dim("start typing…")}`
            : option.label;
        const hint = option.hint ? `  ${option.hint}` : "";
        return `${marker} ${highlighted ? bold(label) : label}${hint}`;
    }).join("\n");

const select = (title : string, options : Array<SelectOption>) : Promise<string> =>
    new Promise(resolve => {
        if (!process.stdin.isTTY) {
            resolve(options.find(option => option.value)?.value ?? "");
            return;
        }

        let state : SelectState = { options, highlighted: 0, typed: "" };
        console.log(title);
        process.stdout.write(renderSelection(state) + "\n");

        const redraw = () => {
            const lines = renderSelection(state).split("\n").map(line => `\x1b[2K${line}`);
            process.stdout.write(`\x1b[${options.length}A${lines.join("\n")}\n`);
        };

        const cleanUp = () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.off("data", onData);
        };

        const onData = (chunk : Buffer) => {
            const input = chunk.toString();
            if (input === "\x03") {
                cleanUp();
                process.exit(130);
            }
            const outcome = reduceSelection(state, input);
            state = outcome.state;
            redraw();
            if (outcome.chosen !== undefined) {
                cleanUp();
                resolve(outcome.chosen);
            }
        };

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on("data", onData);
    });

export { select, reduceSelection, renderSelection };
export type { SelectOption, SelectState, SelectOutcome };
