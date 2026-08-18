import {Actor} from "../actors/Actor";
import {AuditInteraction, Auditor} from "../auditing/Auditor";

/* A schema-validated JSON document store that audits every interaction, keyed
   by collection and id. Public methods audit then defer to ...Internal. */
abstract class JsonStore {

    constructor(protected auditor : Auditor, protected collection : string = "documents") {
    }

    async create(actor : Actor, id : string, document : any) : Promise<void> {
        await this.auditor.audit("document", `${this.collection}/${id}`, actor, [AuditInteraction.CREATE], "Document created", document);
        await this.saveInternal(id, document);
    }

    async save(actor : Actor, changeDescription : string, id : string, document : any) : Promise<void> {
        await this.auditor.audit("document", `${this.collection}/${id}`, actor, [AuditInteraction.UPDATE_PROPERTIES], changeDescription, document);
        await this.saveInternal(id, document);
    }

    async retrieve(id : string, actor : Actor) : Promise<any> {
        await this.auditor.audit("document", `${this.collection}/${id}`, actor, [AuditInteraction.READ], "", null);
        return this.retrieveInternal(id);
    }

    async delete(id : string, actor : Actor) : Promise<void> {
        await this.auditor.audit("document", `${this.collection}/${id}`, actor, [AuditInteraction.DELETE], "", null);
        await this.deleteInternal(id);
    }

    async list(actor : Actor, pageSize? : number, page? : number) : Promise<Array<any>> {
        await this.auditor.audit("document", `${this.collection}/*`, actor, [AuditInteraction.LIST], "", null);
        return this.listInternal(pageSize, page);
    }

    protected abstract saveInternal(id : string, document : any) : Promise<void>;
    protected abstract retrieveInternal(id : string) : Promise<any>;
    protected abstract deleteInternal(id : string) : Promise<void>;
    protected abstract listInternal(pageSize? : number, page? : number) : Promise<Array<any>>;

}

export { JsonStore }
