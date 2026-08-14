# Build context is the monorepo root: docker build -f anbaric-cloud-hosting/Dockerfile .
FROM node:26-slim

WORKDIR /anbaric

COPY package.json package-lock.json tsconfig.base.json ./
COPY tsapi/package.json tsapi/
COPY state-machine/package.json state-machine/
COPY anbaric-cloud/package.json anbaric-cloud/
COPY anbaric-cloud-hosting/package.json anbaric-cloud-hosting/
COPY anbaric-cli/package.json anbaric-cli/
COPY json-store/package.json json-store/
RUN npm ci

COPY tsapi tsapi
COPY state-machine state-machine
COPY anbaric-cloud anbaric-cloud
COPY anbaric-cloud-hosting anbaric-cloud-hosting
COPY anbaric-cli anbaric-cli
COPY json-store json-store

EXPOSE 8787
CMD ["npx", "tsx", "anbaric-cloud-hosting/src/main.ts"]
