type AppAddress = {

    appName : string,
    subdomain : string,
    published : boolean,

};

/* Where this tenant's apps answer. The addresses themselves belong to the
   control plane, because one has to be unique across every tenant and no
   single platform can know that; a platform asks for one and is told.

   A platform that is not part of Anbaric Cloud has no control plane to ask, so
   it has no addresses either and serves its apps by path. That is the whole
   difference, and it is why this is an interface with a do-nothing
   implementation rather than something the rest of the platform must check
   for. */
interface Subdomains {

    allocate(appName : string) : Promise<AppAddress | undefined>;

    set(appName : string, subdomain : string) : Promise<AppAddress>;

    release(appName : string) : Promise<void>;

    all() : Promise<Array<AppAddress>>;

}

export type { Subdomains, AppAddress };
