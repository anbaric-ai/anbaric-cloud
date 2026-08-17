import {Auditor} from "anbaric-tsapi";
import {CloudAuditor} from "anbaric-impl-cloud";
import {ConsoleAuditor} from "./ConsoleAuditor";

const AuditorFactory = {

    instance() : Auditor {
        if (process.env.ANBARIC_AUDITOR_TYPE === "cloud") return new CloudAuditor();
        return new ConsoleAuditor();
    },

};

export { AuditorFactory }
