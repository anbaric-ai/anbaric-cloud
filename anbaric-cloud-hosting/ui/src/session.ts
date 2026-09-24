/* A session that has lapsed does not come back as an error, and it does not
   come back as a readable response either. Central redirects to the identity
   provider, and a fetch that follows a redirect off-origin cannot read what it
   finds, so the call rejects: "Failed to fetch" in one browser, a CORS warning
   in another. The catch swallows it and the screen sits on whatever it last
   knew - for ever, if the session does not come back.

   Asking for the redirect rather than following it turns that into an ordinary
   response we can recognise. Reloading then hands the browser to the login
   flow, which returns here with a session. */
const FOLLOW_NOTHING: RequestInit = { redirect: 'manual' }

const signedOut = (response: Response): boolean => {
  // What a redirect looks like when we declined to follow it.
  if (response.type === 'opaqueredirect' || response.status === 0) return true
  if (!response.redirected) return false

  try {
    return new URL(response.url).origin !== window.location.origin
  } catch {
    return false
  }
}

const signInAgain = () => window.location.reload()

export { signedOut, signInAgain, FOLLOW_NOTHING }
