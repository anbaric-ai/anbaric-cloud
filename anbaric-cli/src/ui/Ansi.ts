const enabled = process.stdout.isTTY ?? false;

const wrap = (open : number, close : number) => (text : string) =>
    enabled ? `\x1b[${open}m${text}\x1b[${close}m` : text;

const bold = wrap(1, 22);
const dim = wrap(2, 22);
const red = wrap(31, 39);
const green = wrap(32, 39);
const yellow = wrap(33, 39);
const cyan = wrap(36, 39);

const check = green("✓");
const cross = red("✗");

export { bold, dim, red, green, yellow, cyan, check, cross }
