/* An app is reachable at a hostname of its own, so that it is served at the
   root of it and works exactly as it did when it was built locally. Two tenants
   will both have a hello-world, so the tenant is part of the name.

   One label, not two: a TLS wildcard matches a single label, so app.tenant.domain
   would need a certificate and a DNS record for every tenant, which would put a
   person in the middle of a self-serve signup. app--tenant.domain needs neither,
   ever. The separator is a double hyphen because an underscore is not legal in a
   hostname and would be rejected by certificates and by some browsers. */

const SEPARATOR = "--";

// A DNS label may not exceed 63 characters, and the whole label is the app and
// the tenant together, so the limit is shared between them.
const LABEL_LIMIT = 63;

const SHAPE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const hostLabelFor = (appName : string, tenant : string) : string => `${appName}${SEPARATOR}${tenant}`;

/* Why this name cannot have a hostname, or undefined when it can. Returned as a
   sentence because it is shown to whoever ran the deploy. */
const hostnameObjection = (appName : string, tenant : string) : string | undefined => {
    if (! SHAPE.test(appName)) {
        return `"${appName}" must be lower-case letters, numbers and hyphens, starting and ending with a letter or number`;
    }
    if (appName.includes(SEPARATOR)) {
        return `"${appName}" cannot contain "${SEPARATOR}" - it is what separates the app from the tenant in its hostname`;
    }
    if (! tenant) return undefined;

    const label = hostLabelFor(appName, tenant);
    if (label.length > LABEL_LIMIT) {
        return `"${appName}" is too long for a hostname alongside tenant "${tenant}": ${label.length} characters, and a hostname label allows ${LABEL_LIMIT}`;
    }
    return undefined;
};

export { hostLabelFor, hostnameObjection, SEPARATOR, LABEL_LIMIT };
