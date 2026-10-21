# Traffic

The console's **Traffic** page shows, for each of your apps, how many pages it
served and to how many different visitors, hour by hour, over the last 24
hours, 48 hours, 7 days or 30 days. It is there for builders; there is nothing
to install or switch on, and nothing in your app's code changes.

## What counts

- **A pageview** is a page of HTML your app served successfully in answer to a
  `GET`. Scripts, styles, images, API calls, errors and pages a browser only
  prefetched are not counted.
- **A visitor** is a person seen on that app that day. A signed-in member is
  known by who they are; anyone else, such as a visitor to a
  [public app](public-apps.md), is known by their connection and browser. The
  visitors for an hour are the different people seen in that hour.

## Privacy

Visitors are counted **without cookies**, so the count needs no consent banner
of yours. The platform does not keep an address, a browser or a user id: it
mixes them with the app and the day under a key only the platform holds and
keeps the digest alone. The same person is a new visitor the next day and on
every other app, and no figure can be traced back to anyone.

## How accurate it is

The figures are estimates. A visitor who changes network during a day counts
twice; people sharing one connection and browser count once; the distinct
counts are approximations. They are good for seeing which apps are used, when
and how much, not for billing anyone.

Traffic is kept for **30 days** and is then gone. It appears within a few
minutes of the visit.
