/* The identity behind a platform session token, as resolved by the platform. */
type ResolvedSession = {

    id : string,
    roles : Array<string>,
    tenant? : string,

};

/* Resolves a platform session token (the anbaric_session cookie) into the
   user's identity. A deployed app cannot verify the token itself - it is signed
   with a platform-only secret - so the resolution is a call to the platform.
   Returns undefined when the token is missing, invalid or expired. */
interface SessionResolver {

    resolve(sessionToken : string) : Promise<ResolvedSession | undefined>;

}

export type { SessionResolver, ResolvedSession }
