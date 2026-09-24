import {Actor} from "../actors/Actor.js";
import {Auditor} from "../auditing/Auditor.js";
import {currentAppId} from "../cloud/AppAware.js";

/* A file as it comes back from storage. Contents are a Uint8Array rather than a
   Node Buffer so the contract stays runtime-agnostic; a Buffer is one, so
   implementations may return it directly. */
type StoredFile = {

    path : string;
    contents : Uint8Array;
    contentType : string;
    size : number;
    lastModified : Date;

};

type StoredFileInfo = Omit<StoredFile, "contents">;

/* Stores files under paths and audits every interaction. Contents never
   appear in an audit record; their size and type do. Paths are relative,
   forward-slash separated, and scoped to the calling app - an implementation
   must refuse anything that could escape that scope. Public methods audit then
   defer to the abstract ...Internal methods. */
abstract class FileStorage {

    constructor(protected auditor : Auditor) {
    }

    async put(actor : Actor, path : string, contents : Uint8Array, contentType : string = "application/octet-stream") : Promise<void> {
        await this.auditor.audit(currentAppId(), "file", path, actor, [FileStorage.Interaction.PUT], "File stored",
            { size: contents.byteLength, contentType });
        await this.putInternal(path, contents, contentType);
    }

    async get(path : string, actor : Actor) : Promise<StoredFile> {
        await this.auditor.audit(currentAppId(), "file", path, actor, [FileStorage.Interaction.READ], "", null);
        return this.getInternal(path);
    }

    async delete(path : string, actor : Actor) : Promise<void> {
        await this.auditor.audit(currentAppId(), "file", path, actor, [FileStorage.Interaction.DELETE], "", null);
        await this.deleteInternal(path);
    }

    async list(prefix : string, actor : Actor) : Promise<Array<StoredFileInfo>> {
        await this.auditor.audit(currentAppId(), "file", prefix || "*", actor, [FileStorage.Interaction.LIST], "", null);
        return this.listInternal(prefix);
    }

    protected abstract putInternal(path : string, contents : Uint8Array, contentType : string) : Promise<void>;
    protected abstract getInternal(path : string) : Promise<StoredFile>;
    protected abstract deleteInternal(path : string) : Promise<void>;
    protected abstract listInternal(prefix : string) : Promise<Array<StoredFileInfo>>;

}

namespace FileStorage {

    export enum Interaction {
        PUT = "PUT",
        READ = "READ",
        DELETE = "DELETE",
        LIST = "LIST",
    }

}

export { FileStorage };
export type { StoredFile, StoredFileInfo };
