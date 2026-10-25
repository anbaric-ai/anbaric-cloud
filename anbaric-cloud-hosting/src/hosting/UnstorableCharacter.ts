const NUL = "\u0000";

const pathOf = (parent : string, key : string | number) : string =>
    typeof key === "number" ? `${parent}[${key}]` : parent === "" ? key : `${parent}.${key}`;

/* Where in a value the platform would be unable to store it: the path of the
   first string holding a NUL character (U+0000), which scraped and decoded
   text sometimes carries, or undefined when the whole value can be stored. */
const unstorableCharacterIn = (value : unknown, path : string = "") : string | undefined => {
    if (typeof value === "string") return value.includes(NUL) ? path : undefined;
    if (value === null || typeof value !== "object") return undefined;

    const entries : Array<[string | number, unknown]> = Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);
    for (const [key, item] of entries) {
        if (typeof key === "string" && key.includes(NUL)) return pathOf(path, key);
        const found = unstorableCharacterIn(item, pathOf(path, key));
        if (found !== undefined) return found;
    }
    return undefined;
};

export { unstorableCharacterIn }
