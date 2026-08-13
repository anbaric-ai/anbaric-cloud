import {Job} from "./Job";

interface JobPersistence {

    save(job : Job) : void;
    retrieve(id : string) : Job;
    delete(id : string) : void;
    list(pageSize? : number, page? : number) : Array<Job>;
    updateProperties(id : string, properties : Map<string, any>) : void;

}

export { JobPersistence }