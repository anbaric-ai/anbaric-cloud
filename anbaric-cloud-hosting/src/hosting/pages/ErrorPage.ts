import {readFileSync} from "node:fs";

/* Pages for the moments when there is nothing to show. These are served by the
   platform itself rather than the console bundle, so they carry no assets and
   no stylesheet: the values below are the design system's own tokens, and the
   logo beside them is its lockup, both copied because the platform has no way
   to read that package at runtime. Keep them in step with
   anbaric-design-system/tokens.css and shared/assets/anbaric-logo.svg.

   A page that says "back in a moment" is worth more than a stack trace to
   someone who only wanted to look at an app while it happened to be mid-deploy. */

const LOGO = `data:image/svg+xml;base64,${readFileSync(new URL("./assets/anbaric-logo.svg", import.meta.url)).toString("base64")}`;

const TOKENS = {
    background: "#f7f8fa",
    surface: "#ffffff",
    edge: "#eaebef",
    foreground: "#14131c",
    muted: "#6f6f7c",
    title: '"Founders Grotesk", "Inter", system-ui, -apple-system, sans-serif',
};

type ErrorPage = {
    status : number,
    heading : string,
    detail : string,

    /* Seconds until the page reloads itself. Only for states that are known to
       be temporary: a page that retries something permanently broken is just a
       flicker, and it hides the fact that nothing is going to change. */
    retryAfter? : number,
};

const escapeHtml = (text : string) : string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const render = (page : ErrorPage) : string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.heading)}</title>
${page.retryAfter ? `<meta http-equiv="refresh" content="${page.retryAfter}">` : ""}
<style>
  :root { color-scheme: light }
  body {
    margin: 0;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${TOKENS.background};
    color: ${TOKENS.foreground};
    font-family: ${TOKENS.title};
    padding: 1.5rem;
    box-sizing: border-box;
  }
  main {
    max-width: 30rem;
    width: 100%;
    background: ${TOKENS.surface};
    border: 1px solid ${TOKENS.edge};
    border-radius: 1.125rem;
    padding: 2rem;
  }
  .logo { display: block; height: 3rem; width: auto; margin: 0 0 1.5rem }
  h1 { margin: 0 0 0.5rem; font-size: 1.4rem; line-height: 1.25; text-transform: uppercase }
  p { margin: 0; color: ${TOKENS.muted}; font-size: 0.95rem; line-height: 1.6 }
  .waiting { margin-top: 1.5rem; font-size: 0.85rem; color: ${TOKENS.muted} }
</style>
</head>
<body>
  <main>
    <img class="logo" src="${LOGO}" alt="Anbaric">
    <h1>${escapeHtml(page.heading)}</h1>
    <p>${escapeHtml(page.detail)}</p>
    ${page.retryAfter ? `<p class="waiting">This page checks again every ${page.retryAfter} seconds.</p>` : ""}
  </main>
</body>
</html>`;

const NOT_FOUND : ErrorPage = {
    status: 404,
    heading: "Nothing here",
    detail: "That address does not match anything on this platform. If you followed a link, it may be out of date.",
};

const DEPLOYING : ErrorPage = {
    status: 503,
    heading: "Just a moment",
    detail: "This app is being deployed. It will be back as soon as the new version is running.",
    retryAfter: 5,
};

const NOT_RUNNING : ErrorPage = {
    status: 503,
    heading: "Not running",
    detail: "This app is not running at the moment. Someone with access can start it again from the console.",
};

const FAILED : ErrorPage = {
    status: 503,
    heading: "This app did not start",
    detail: "Its last deployment failed, so there is nothing to serve yet. The console has the build log.",
};

export { render, NOT_FOUND, DEPLOYING, NOT_RUNNING, FAILED };
export type { ErrorPage };
