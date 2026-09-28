import {Agent, AgenticAction, AgentMessage, AgentRequest, Job} from "anbaric-tsapi";

/* An OpenAI-API-compatible agentic action: it carries a prompt as an array of
   chat messages and a JSON Schema, appends the job's properties as the final
   user message, and lets its agent's client generate the properties to write.
   The properties appended are the ones the job holds - what its state
   prewarmed, plus anything read since - so a state that prewarms a little of
   a large job sends the model a little. */
class RemoteLLMAgenticAction extends AgenticAction {

    private messages : Array<AgentMessage>;
    private outputSchema : object;

    constructor(name : string, agent : Agent, messages : Array<AgentMessage>, outputSchema : object,
                description : string = "", id? : string) {
        super(name, agent, description, id);
        this.messages = messages;
        this.outputSchema = outputSchema;
    }

    protected requestFor(job : Job) : AgentRequest {
        return {
            messages: [...this.messages, { role: "user", content: JSON.stringify(Object.fromEntries(job.properties.snapshot())) }],
            outputSchema: this.outputSchema,
        };
    }

}

export { RemoteLLMAgenticAction }
