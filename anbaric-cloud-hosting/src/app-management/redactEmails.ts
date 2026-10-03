const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/* An app's logs are read by its builders, who are not owed the addresses of
   the people using it. Each address keeps the first two letters of its local
   part, enough to tell one person's line from another's, and loses the rest
   to a fixed shape: the same number of asterisks whatever the address, so the
   redaction gives away neither its length nor its domain. */
const redactEmails = (line : string) : string =>
    line.replace(EMAIL, address => `${address.split("@")[0].slice(0, 2).toLowerCase()}****@****.**`);

export { redactEmails };
