import {Pool} from "pg";
import {createHash} from "node:crypto";
import {Card} from "@anbaric/design-system/components/Card";

const PgWidget = () => <Card>A widget whose data reads the database.</Card>;

const plugin = {
    name: "pg-plugin",
    pages: [{ path: "/pg", title: "Pg", navOrder: 5 }],
    widgets: [
        {
            page: "/pg",
            id: "pg-backed",
            component: PgWidget,
            data: async () => ({ pool: typeof Pool, hash: typeof createHash }),
        },
    ],
};

export { plugin }
