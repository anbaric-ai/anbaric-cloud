import {Request} from "./Request";

/* Runs before routing; may decorate the request or answer it. Returning
   false stops the chain - the middleware has written the response. */
interface Middleware {

    apply(request : Request) : Promise<boolean>;

}

export type { Middleware }
