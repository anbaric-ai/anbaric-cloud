import {Actor} from "../actors/Actor";

interface Auditor {

    audit(jobId : string, actor : Actor | undefined, changeDescription : string, details : any) : Promise<void>;

}

export type { Auditor }
