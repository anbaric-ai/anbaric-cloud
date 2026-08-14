# Build context is the monorepo root: docker build -f anbaric-cloud-hosting/Dockerfile .
FROM node:26-slim

WORKDIR /anbaric

COPY package.json package-lock.json tsconfig.base.json ./
COPY tsapi/package.json tsapi/
COPY anbaric-state-machine/package.json anbaric-state-machine/
COPY anbaric-cloud/package.json anbaric-cloud/
COPY anbaric-cloud-hosting/package.json anbaric-cloud-hosting/
COPY anbaric-cli/package.json anbaric-cli/
COPY anbaric-data-store/package.json anbaric-data-store/
RUN npm ci

COPY tsapi tsapi
COPY anbaric-state-machine anbaric-state-machine
COPY anbaric-cloud anbaric-cloud
COPY anbaric-cloud-hosting anbaric-cloud-hosting
COPY anbaric-cli anbaric-cli
COPY anbaric-data-store anbaric-data-store

EXPOSE 8787
CMD ["npx", "tsx", "anbaric-cloud-hosting/src/main.ts"]
