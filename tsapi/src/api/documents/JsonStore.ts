interface JsonStore {

    save(id : string, document : any) : Promise<void>;
    retrieve(id : string) : Promise<any>;
    delete(id : string) : Promise<void>;
    list(pageSize? : number, page? : number) : Promise<Array<any>>;

}

export { JsonStore }
