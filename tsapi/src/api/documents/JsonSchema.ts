type JsonSchema = {
    type? : "object" | "array" | "string" | "number" | "integer" | "boolean" | "null",
    properties? : Record<string, JsonSchema>,
    required? : Array<string>,
    items? : JsonSchema,
    enum? : Array<any>,
};

const jsonTypeOf = (value : any) : string => {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
    return typeof value;
};

const matchesType = (value : any, expected : string) : boolean => {
    const actual = jsonTypeOf(value);
    return expected === "number" ? actual === "number" || actual === "integer" : actual === expected;
};

const isPlainObject = (value : any) : boolean => jsonTypeOf(value) === "object";

const validateDocument = (document : any, schema : JsonSchema, path : string = "$") : Array<string> => {
    const violations : Array<string> = [];

    if (schema.type && !matchesType(document, schema.type)) {
        violations.push(`${path} should be ${schema.type} but was ${jsonTypeOf(document)}`);
        return violations;
    }

    if (schema.enum && !schema.enum.some(allowed => JSON.stringify(allowed) === JSON.stringify(document))) {
        violations.push(`${path} must be one of ${JSON.stringify(schema.enum)}`);
    }

    if (isPlainObject(document)) {
        for (const key of schema.required ?? []) {
            if (!(key in document)) violations.push(`${path}.${key} is required`);
        }
        for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
            if (key in document) violations.push(...validateDocument(document[key], propertySchema, `${path}.${key}`));
        }
    }

    if (Array.isArray(document) && schema.items) {
        document.forEach((item, index) =>
            violations.push(...validateDocument(item, schema.items!, `${path}[${index}]`)));
    }

    return violations;
};

export { validateDocument };
export type { JsonSchema };
