/* Where an app is served, decided in one place because the console, the CLI
   and anything else that shows a person a link must all show the same one.

   Its own address, allocated by the control plane, which is the only form on
   Anbaric Cloud. Then the app's name under the configured host suffix, which
   is what a self-hoster gets who has pointed their own wildcard at the
   platform and has no control plane to allocate anything - one platform serves
   one tenant there, so the name alone is unambiguous. Then the path form,
   which always works and is what a platform run locally uses.

   An app's own hostname serves it at the root, so links, assets and fetches
   inside it behave as they did on the machine it was built on. */
const appAddress = (appName : string, subdomain? : string, hostSuffix : string = process.env.ANBARIC_APP_HOST_SUFFIX ?? "") : string => {
    if (! hostSuffix) return `/app/${appName}`;

    return `https://${subdomain ?? appName}.${hostSuffix}`;
};

export { appAddress };
