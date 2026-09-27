/* The shape the structured-output APIs (OpenAI's strict mode, Anthropic's
   json_schema format) insist on: every object closes itself to unknown keys
   and names every property as required, all the way down. */
const strictSchema = (schema : any) : any => {
    if (schema?.type === "object" && schema.properties) {
        return {
            ...schema,
            required: Object.keys(schema.properties),
            additionalProperties: false,
            properties: Object.fromEntries(
                Object.entries(schema.properties).map(([key, property]) => [key, strictSchema(property)])),
        };
    }
    if (schema?.type === "array" && schema.items) {
        return { ...schema, items: strictSchema(schema.items) };
    }
    return schema;
};

export { strictSchema };
