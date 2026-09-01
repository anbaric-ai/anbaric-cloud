import {Actor} from "../actors/Actor";
import {Auditor} from "./Auditor";

/* An auditor that records nothing. Used by the persistence instances that sit
   behind the HTTP API, where the app-facing store on the other side has
   already audited the interaction. */
class NoOpAuditor implements Auditor {

    async audit(_appId : string | undefined, _resourceType : string, _resourceId : string, _actor : Actor,
                _interaction : Array<string>, _description : string, _details : any) : Promise<void> {
    }

}

export { NoOpAuditor }
