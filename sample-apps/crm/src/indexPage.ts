import {SerializedJob} from "anbaric-tsapi";

const escapeHtml = (text : string) : string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const customerRow = (customer : SerializedJob) : string => `
        <tr>
            <td>${escapeHtml(String(customer.properties.name ?? ""))}</td>
            <td>${escapeHtml(String(customer.properties.email ?? ""))}</td>
            <td><code>${escapeHtml(customer.state)}</code></td>
            <td><code>${escapeHtml(customer.id)}</code></td>
        </tr>`;

const indexPage = (customers : Array<SerializedJob>) : string => `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>CRM</title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 48rem; }
        table { border-collapse: collapse; width: 100%; }
        th, td { text-align: left; padding: 0.4rem 0.8rem; border-bottom: 1px solid #ddd; }
        code { background: #f4f4f4; padding: 0.1rem 0.3rem; }
    </style>
</head>
<body>
    <h1>CRM</h1>
    <p>${customers.length} customer${customers.length === 1 ? "" : "s"}, managed by the
       <code>customer-onboarding</code> state machine.</p>
    <table>
        <tr><th>Name</th><th>Email</th><th>State</th><th>Job</th></tr>${customers.map(customerRow).join("")}
    </table>
    <p>Create one with:</p>
    <pre>curl -X POST customers -H 'content-type: application/json' \\
     -d '{"name": "Ada Lovelace", "email": "ada@example.com"}'</pre>
</body>
</html>`;

export { indexPage }
