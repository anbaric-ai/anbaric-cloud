import {Job} from "./Job";

interface JobPersistence {

    save(job : Job) : Promise<void>;
    retrieve(id : string) : Promise<Job>;
    delete(id : string) : Promise<void>;
    list(pageSize? : number, page? : number) : Promise<Array<Job>>;
    updateProperties(id : string, properties : Map<string, any>) : Promise<void>;

}

export { JobPersistence }
