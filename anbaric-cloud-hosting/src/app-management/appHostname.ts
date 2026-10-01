/* An app is reachable at a hostname of its own, so that it is served at the
   root of it and works exactly as it did when it was built locally.

   The address itself is one DNS label and belongs to the control plane, which
   is the only thing that can see every tenant and so the only thing that can
   keep an address unique. What is checked here is narrower and local: that the
   app's name could be a hostname label at all, since it is the first address
   the control plane will be asked for.

   A hosted app whose name is already taken is given a different address rather
   than refused, so this is about shape, never about availability. */

/* A DNS label may not exceed 63 characters, and the control plane may have to
   add a distinguishing word to a name two tenants both wanted - so a name is
   held well short of the limit to leave room for one. */
const NAME_LIMIT = 48;

const SHAPE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/* Why this name cannot have a hostname, or undefined when it can. Returned as a
   sentence because it is shown to whoever ran the deploy. */
const hostnameObjection = (appName : string) : string | undefined => {
    if (! SHAPE.test(appName)) {
        return `"${appName}" must be lower-case letters, numbers and hyphens, starting and ending with a letter or number`;
    }
    if (appName.length > NAME_LIMIT) {
        return `"${appName}" is too long for an app name: ${appName.length} characters, and the limit is ${NAME_LIMIT}`;
    }
    return undefined;
};

export { hostnameObjection, NAME_LIMIT };
