import {Action, JobPersistence, PropertyDefinition, Queue, State, Transition} from "anbaric-tsapi";
import {ConsumerFactory, DefaultActionResolver, StateMachine} from "anbaric-state-machine";

const requiredText = (id : string, validation : (value : any) => boolean) => {
    const property = new PropertyDefinition(id);
    property.required = true;
    property.validation = (value) => typeof value === "string" && validation(value);
    return property;
};

const sendWelcome = () => {
    const action = new Action();
    action.run = (job) => {
        console.log(`sending welcome email to ${job.properties.get("email")}`);
        job.properties.set("welcomeSent", true);
        return job;
    };
    return action;
};

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
    ],
    new DefaultActionResolver(),
    persistence,
    queue,
    ConsumerFactory.instance(queue),
);

export { customerWorkflow }
