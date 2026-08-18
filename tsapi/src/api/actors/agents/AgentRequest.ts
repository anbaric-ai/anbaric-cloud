import {AgentMessage} from "./AgentMessage";

type AgentRequest = {

    messages : Array<AgentMessage>;
    outputSchema : object;

};

export type { AgentRequest }
