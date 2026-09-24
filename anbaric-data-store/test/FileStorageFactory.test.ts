import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {CloudFileStorage} from "anbaric-impl-cloud";
import {FileStorageFactory} from "../src/FileStorageFactory";
import {LocalFileSystemStorage} from "../src/LocalFileSystemStorage";

describe("FileStorageFactory", () => {

    let previous : string | undefined;

    beforeEach(() => {
        previous = process.env.ANBARIC_FILE_STORAGE_TYPE;
    });

    afterEach(() => {
        if (previous === undefined) delete process.env.ANBARIC_FILE_STORAGE_TYPE;
        else process.env.ANBARIC_FILE_STORAGE_TYPE = previous;
    });

    it("defaults to the local file system when nothing is configured", () => {
        delete process.env.ANBARIC_FILE_STORAGE_TYPE;

        expect(FileStorageFactory.instance()).toBeInstanceOf(LocalFileSystemStorage);
    });

    it("gives the local file system when asked for local", () => {
        process.env.ANBARIC_FILE_STORAGE_TYPE = "local";

        expect(FileStorageFactory.instance()).toBeInstanceOf(LocalFileSystemStorage);
    });

    it("gives the cloud storage when asked for cloud", () => {
        process.env.ANBARIC_FILE_STORAGE_TYPE = "cloud";

        expect(FileStorageFactory.instance()).toBeInstanceOf(CloudFileStorage);
    });

    it("returns a fresh storage per call", () => {
        delete process.env.ANBARIC_FILE_STORAGE_TYPE;

        expect(FileStorageFactory.instance()).not.toBe(FileStorageFactory.instance());
    });

});
