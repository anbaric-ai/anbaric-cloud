import {User} from "./User";

type DirectoryUser = {

    id : string,
    name : string,
    email : string,
    picture? : string,
    firstSeenAt : string,
    lastSeenAt : string,

};

/* Everyone who has signed in to this tenant, as the platform saw them at
   their last sign-in. A tenant-local directory: it needs no identity-provider
   organisation, so it works for a single-owner tenant as much as a team. */
interface UserDirectory {

    record(user : User) : Promise<void>;

    list() : Promise<Array<DirectoryUser>>;

}

export type { UserDirectory, DirectoryUser }
