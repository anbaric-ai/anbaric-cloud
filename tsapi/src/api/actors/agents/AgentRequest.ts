import {AgentMessage} from "./AgentMessage.js";

type AgentRequest = {

    messages : Array<AgentMessage>;
    outputSchema : object;

};

export type { AgentRequest }
