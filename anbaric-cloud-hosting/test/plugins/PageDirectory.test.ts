import {describe, expect, it} from "vitest";
import {PageDirectory} from "../../src/plugins/PageDirectory";
import {LoadedPlugin, PluginPage} from "../../src/plugins/Plugin";

const loaded = (name : string, pages : Array<PluginPage>) : LoadedPlugin =>
    ({ name, plugin: { name, pages, widgets: [] }, bundle: "" });

describe("PageDirectory", () => {

    it("merges pages from every plugin sorted by nav order then title", () => {
        const directory = new PageDirectory([
            loaded("first", [{ path: "/zebra", title: "Zebra" }, { path: "/", title: "Dashboard", navOrder: 0 }]),
            loaded("second", [{ path: "/apple", title: "Apple" }]),
        ]);

        expect(directory.pages.map(page => page.title)).toEqual(["Dashboard", "Apple", "Zebra"]);
    });

    it("rejects two plugins registering the same page path", () => {
        expect(() => new PageDirectory([
            loaded("first", [{ path: "/about", title: "About" }]),
            loaded("second", [{ path: "/about", title: "Also About" }]),
        ])).toThrowError('Two plugins register the page path "/about"');
    });

    it("lists the unique top-level path segments, ignoring the root page", () => {
        const directory = new PageDirectory([
            loaded("first", [{ path: "/", title: "Dashboard" }, { path: "/about", title: "About" }]),
            loaded("second", [{ path: "/about/team", title: "Team" }, { path: "/reports", title: "Reports" }]),
        ]);

        expect(directory.topLevelSegments).toEqual(["about", "reports"]);
    });

});
