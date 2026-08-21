/* The serialisable graph of a state machine: its states, each state's actions
   (identity only — the run/predicate bodies aren't persistable) and
   transitions. Recorded as the details of an audit record when a state machine
   initialises. */
type WorkflowDefinition = {

    workflowId : string,
    startState : string,
    dataSchema : Array<{ id : string, required : boolean }>,
    states : Array<{
        id : string,
        isTerminal : boolean,
        actions : Array<{ name : string, description : string, actor : { id : string, type : string, role : string } }>,
        transitions : Array<{ to : string }>,
    }>,

};

export type { WorkflowDefinition }
