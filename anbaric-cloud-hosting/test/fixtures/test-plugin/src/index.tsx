import {useState} from "react";
import {Card} from "@anbaric/design-system/components/Card";
import "./CounterWidget.css";

const CounterWidget = () => {
    const [count] = useState(0);
    return <Card>Counted {count}</Card>;
};

const plugin = {
    name: "test-plugin",
    pages: [{ path: "/testing", title: "Testing", icon: "info", navOrder: 5 }],
    widgets: [
        {
            page: "/testing",
            id: "counter",
            component: CounterWidget,
            data: async (parameters : Record<string, string>) => ({ echoed: parameters }),
        },
    ],
};

export { plugin }
