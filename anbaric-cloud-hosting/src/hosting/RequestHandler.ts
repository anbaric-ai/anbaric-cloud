import {Request} from "./Request";

interface RequestHandler {

    handle(request : Request) : Promise<void>;

}

export type { RequestHandler }
