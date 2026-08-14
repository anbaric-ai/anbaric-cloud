import {Action, JobPersistence, PropertyDefinition, Queue, State, Transition} from "anbaric-tsapi";
import {Code, StateMachine} from "anbaric-state-machine";

const requiredText = (id : string, validation : (value : any) => boolean) => {
    const property = new PropertyDefinition(id);
    property.required = true;
    property.validation = (value) => typeof value === "string" && validation(value);
    return property;
};

const optionalFlag = (id : string) => {
    const property = new PropertyDefinition(id);
    property.validation = (value) => typeof value === "boolean";
    return property;
};

const sendWelcome = () => new Action(
    "Send welcome email",
    new Code("send-welcome-email", async (job) => {
        console.log(`sending welcome email to ${job.properties.get("email")}`);
        return new Map([["welcomeSent", true]]);
    }),
    "Emails a welcome message to a newly registered customer",
);

const customerWorkflow = (persistence : JobPersistence, queue : Queue) => new StateMachine(
    "customer-onboarding",
    [
        new State("new", [sendWelcome()], [new Transition("active", (job) => job.properties.get("welcomeSent") === true)]),
        new State("active"),
    ],
    "new",
    [
        requiredText("name", (value) => value.length > 0),
        requiredText("email", (value) => value.includes("@")),
        optionalFlag("welcomeSent"),
    ],
    persistence,
    queue,
);

export { customerWorkflow }
