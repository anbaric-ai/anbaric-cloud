import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class PingHandler implements RequestHandler {

    constructor(private tenant? : string) {}

    async handle(request : Request) : Promise<void> {
        switch (request.method) {
            case "GET":
                return request.reply(200, this.tenant ? { status: "ok", tenant: this.tenant } : { status: "ok" });
        }
        request.notFound();
    }

}

export { PingHandler }
