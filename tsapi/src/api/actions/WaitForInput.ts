type AwaitParty = "HUMAN" | "EXTERNAL_SYSTEM";

/* What an Await is waiting for: which kind of party (a human or an external
   system), the input fields it expects, a URL a client can send the user to in
   order to provide them, and any extra metadata. A pure data class - it carries
   no behaviour. */
class WaitForInput {

    fields : Array<string>;
    resolveUrl : string;
    metadataMap : Map<string, any>;
    waitingFor? : AwaitParty;

    constructor(fields : Array<string> = [], resolveUrl : string = "",
                metadataMap : Map<string, any> = new Map(), waitingFor? : AwaitParty) {
        this.fields = fields;
        this.resolveUrl = resolveUrl;
        this.metadataMap = metadataMap;
        this.waitingFor = waitingFor;
    }

}

type SerializedWaitForInput = {
    fields : Array<string>,
    resolveUrl : string,
    metadataMap : Record<string, any>,
    waitingFor? : AwaitParty,
};

const serializeWaitForInput = (wait : WaitForInput) : SerializedWaitForInput => ({
    fields: wait.fields,
    resolveUrl: wait.resolveUrl,
    metadataMap: Object.fromEntries(wait.metadataMap),
    waitingFor: wait.waitingFor,
});

const deserializeWaitForInput = (serialized : SerializedWaitForInput) : WaitForInput =>
    new WaitForInput(serialized.fields ?? [], serialized.resolveUrl ?? "",
        new Map(Object.entries(serialized.metadataMap ?? {})), serialized.waitingFor);

export { WaitForInput, serializeWaitForInput, deserializeWaitForInput };
export type { SerializedWaitForInput, AwaitParty };
