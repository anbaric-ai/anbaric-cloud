import {AppAware, Auditor, currentAppId, FileStorage, NoOpAuditor, StoredFile, StoredFileInfo} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient.js";

/* Files kept by the platform on the app's behalf. The path travels as a query
   parameter rather than in the URL path, because a file path has slashes of
   its own and the platform's routes would read them as resource segments. */
class CloudFileStorage extends FileStorage implements AppAware {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl(), auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
        this.client = new CloudApiClient(baseUrl);
    }

    getAppId() : string {
        return currentAppId();
    }

    protected async putInternal(path : string, contents : Uint8Array, contentType : string) : Promise<void> {
        await this.client.requestBytes("PUT", this.itemPath(path), contents, contentType);
    }

    protected async getInternal(path : string) : Promise<StoredFile> {
        const response = await this.client.requestBytes("GET", this.itemPath(path));
        return {
            path,
            contents: response.bytes,
            contentType: response.contentType,
            size: response.bytes.byteLength,
            lastModified: response.lastModified ? new Date(response.lastModified) : new Date(),
        };
    }

    protected async deleteInternal(path : string) : Promise<void> {
        await this.client.request("DELETE", this.itemPath(path));
    }

    protected async listInternal(prefix : string) : Promise<Array<StoredFileInfo>> {
        const listed = await this.client.request("GET", `/files?prefix=${encodeURIComponent(prefix)}&all=true`) as {
            files : Array<Omit<StoredFileInfo, "lastModified"> & { lastModified : string }>,
        };
        return listed.files.map(file => ({ ...file, lastModified: new Date(file.lastModified) }));
    }

    private itemPath(path : string) : string {
        return `/files/item?path=${encodeURIComponent(path)}`;
    }

}

export { CloudFileStorage }
