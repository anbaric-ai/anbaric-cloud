import {LoadedPlugin, PluginPage} from "./Plugin";

/* The merged view of every page the loaded plugins register: feeds the nav
   manifest and tells the hosting server which top-level path segments must
   serve the dashboard ahead of the app proxy fallback. */
class PageDirectory {

    private pagesByPath = new Map<string, PluginPage>();

    constructor(plugins : Array<LoadedPlugin>) {
        for (const loaded of plugins) {
            for (const page of loaded.plugin.pages) {
                if (this.pagesByPath.has(page.path)) {
                    throw new Error(`Two plugins register the page path "${page.path}"`);
                }
                this.pagesByPath.set(page.path, page);
            }
        }
    }

    get pages() : Array<PluginPage> {
        return [...this.pagesByPath.values()]
            .sort((left, right) => (left.navOrder ?? 100) - (right.navOrder ?? 100) || left.title.localeCompare(right.title));
    }

    get topLevelSegments() : Array<string> {
        const segments = this.pages
            .map(page => page.path.split("/").filter(Boolean)[0])
            .filter((segment) : segment is string => segment !== undefined);
        return [...new Set(segments)];
    }

}

export { PageDirectory }
