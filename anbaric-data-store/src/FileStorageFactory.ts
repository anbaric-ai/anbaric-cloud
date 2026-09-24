import {FileStorage, NoOpAuditor} from "anbaric-tsapi";
import {CloudAuditor, CloudFileStorage} from "anbaric-impl-cloud";
import {LocalFileSystemStorage} from "./LocalFileSystemStorage.js";

const FileStorageFactory = {
    instance() : FileStorage {
        switch (process.env.ANBARIC_FILE_STORAGE_TYPE) {
            case "cloud":
                return new CloudFileStorage(undefined, new CloudAuditor());
            case "local":
            default:
                return new LocalFileSystemStorage(undefined, new NoOpAuditor());
        }
    }
}

export { FileStorageFactory };
