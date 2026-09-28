import {PropertyDefinition} from "./PropertyDefinition.js";

/* What an action, await or transition reads from a job, expressed against the
   machine's property definitions rather than as a fixed list, so a mapping
   written once keeps up as the schema grows: "everything", "only these", or
   "whatever matches". Only the properties named are loaded for the job before
   the step runs, and only they reach a model's prompt. */
type Reads = (definitions : Array<PropertyDefinition>) => Array<string>;

namespace Reads {

    export const everything : Reads = definitions => definitions.map(definition => definition.id);

    export const nothing : Reads = () => [];

    export const only = (...keys : Array<string>) : Reads => () => keys;

    export const where = (predicate : (definition : PropertyDefinition) => boolean) : Reads =>
        definitions => definitions.filter(predicate).map(definition => definition.id);

}

export { Reads };
