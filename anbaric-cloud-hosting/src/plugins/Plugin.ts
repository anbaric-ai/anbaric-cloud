type PluginComponent = (properties : any) => unknown;

type PluginPage = {

    path : string;
    title : string;
    icon? : string;
    navOrder? : number;

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
