/* A session that has lapsed does not come back as an error. Central answers
   with a redirect to the identity provider, fetch follows it, and the page gets
   a perfectly good 200 full of somebody else's HTML. Parsing it throws, the
   catch swallows it, and the screen sits on whatever it last knew - for ever.

   Being sent to another origin is the signal. Reloading hands the browser back
   to the login flow, which returns here with a session, or shows the sign-in
   page if there is no longer one to resume. */
const signedOut = (response: Response): boolean => {
  if (!response.redirected) return false

  try {
    return new URL(response.url).origin !== window.location.origin
  } catch {
    return false
  }
}

const signInAgain = () => window.location.reload()

export { signedOut, signInAgain }
