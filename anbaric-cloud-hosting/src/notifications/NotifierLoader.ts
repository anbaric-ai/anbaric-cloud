import {Notifier} from "anbaric-tsapi";

/* Loads the server-side notifier by module name, the same way the authenticator
   is loaded (see AuthenticatorLoader). The platform is open source and cannot
   name a proprietary delivery mechanism, so a host names its module through
   ANBARIC_NOTIFIER_MODULE and that module exports a createNotifier factory.
   With nothing named, the platform accepts notifications but delivers nothing. */
const loadNotifier = async (moduleName? : string) : Promise<Notifier | undefined> => {
    if (!moduleName) return undefined;

    const module = await import(moduleName);
    if (typeof module.createNotifier !== "function") {
        throw new Error(`Notifier module "${moduleName}" does not export a createNotifier function`);
    }
    return module.createNotifier();
};

export { loadNotifier }
