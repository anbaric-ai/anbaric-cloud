import {PropertyDefinition} from "./PropertyDefinition.js";

/* Which of a job's properties to load ahead of a state's pass, expressed
   against the machine's property definitions rather than as a fixed list, so
   a mapping written once keeps up as the schema grows: "everything", "only
   these", or "whatever matches". Anything a step reads that was not loaded
   ahead still loads on demand; this only decides what comes in one fetch. */
type Reads = (definitions : Array<PropertyDefinition>) => Array<string>;

namespace Reads {

    export const everything : Reads = definitions => definitions.map(definition => definition.id);

    export const nothing : Reads = () => [];

    export const only = (...keys : Array<string>) : Reads => () => keys;

    export const where = (predicate : (definition : PropertyDefinition) => boolean) : Reads =>
        definitions => definitions.filter(predicate).map(definition => definition.id);

}

export { Reads };
