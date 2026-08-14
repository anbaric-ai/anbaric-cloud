const parseValue = (raw : string) : any => {
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
};

const parsePropertyPairs = (pairs : Array<string>) : Record<string, any> => {
    const properties : Record<string, any> = {};

    for (const pair of pairs) {
        const separator = pair.indexOf("=");
        if (separator <= 0) {
            throw new Error(`"${pair}" is not a property=value pair`);
        }
        properties[pair.slice(0, separator)] = parseValue(pair.slice(separator + 1));
    }

    return properties;
};

export { parsePropertyPairs }
