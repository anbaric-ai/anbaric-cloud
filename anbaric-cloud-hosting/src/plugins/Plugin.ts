type PluginComponent = (properties : any) => unknown;

type PluginPage = {

    path : string;
    title : string;
    icon? : string;
    navOrder? : number;
    /* Where the console offers the page. The nav rail by default; the account
       menu for a page about the tenant or the person rather than the work -
       billing, say. Either way the page is reachable at its path. */
    placement? : "nav" | "account";

};

type PluginWidget = {

    page : string;
    id : string;
    title? : string;
    position? : number;
    component : PluginComponent;
    data? : (parameters : Record<string, string>) => Promise<unknown>;

};

type Plugin = {

    name : string;
    pages : Array<PluginPage>;
    widgets : Array<PluginWidget>;

};

type LoadedPlugin = {

    name : string;
    plugin : Plugin;
    bundle : string;

};

export { Plugin, PluginPage, PluginWidget, PluginComponent, LoadedPlugin }
