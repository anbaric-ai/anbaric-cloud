import {PromptManager} from "anbaric-tsapi";
import {CloudPromptManager} from "anbaric-impl-cloud";
import {InMemoryPromptManager} from "./InMemoryPromptManager.js";

const PromptManagerFactory = {
    instance() : PromptManager {
        switch (process.env.ANBARIC_PROMPT_MANAGER_TYPE) {
            case "cloud":
                return new CloudPromptManager();
            case "memory":
            default:
                return new InMemoryPromptManager();
        }
    }
}

export { PromptManagerFactory };
