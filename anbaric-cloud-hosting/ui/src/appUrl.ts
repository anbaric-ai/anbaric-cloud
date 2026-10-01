type CurrentUser = {
  id: string
  roles: string[]
  name?: string
  picture?: string
  tenant?: string
  tenantRole?: string
  /* The domain under which each app has a hostname of its own. Sent by the
     platform rather than guessed from the browser's address, because only the
     platform knows whether wildcard DNS exists for it. Used for showing an
     address, not for building one. */
  appHostSuffix?: string
}

/* Where an app is served. The platform decides this and sends it, because the
   console, the CLI and anything else that puts a link in front of a person
   have to agree, and only the platform knows whether its apps have hostnames
   of their own. The fallback is for an older platform that does not say. */
const appUrl = (app: { appName: string; url?: string }): string => app.url ?? `/app/${app.appName}`

export { appUrl }
export type { CurrentUser }
