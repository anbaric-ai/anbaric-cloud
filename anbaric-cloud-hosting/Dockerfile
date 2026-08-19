# Build context is the monorepo root: docker build -f anbaric-cloud-hosting/Dockerfile .
FROM node:26-slim

RUN apt-get update && apt-get install -y ca-certificates curl && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    echo "deb [signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
        > /etc/apt/sources.list.d/docker.list && \
    apt-get update && apt-get install -y docker-ce-cli && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /anbaric

COPY package.json package-lock.json tsconfig.base.json ./
COPY tsapi/package.json tsapi/
COPY anbaric-state-machine/package.json anbaric-state-machine/
COPY anbaric-impl-cloud/package.json anbaric-impl-cloud/
COPY anbaric-cloud-hosting/package.json anbaric-cloud-hosting/
COPY anbaric-cli/package.json anbaric-cli/
COPY anbaric-data-store/package.json anbaric-data-store/
COPY anbaric/package.json anbaric/
COPY anbaric-hosting/package.json anbaric-hosting/
COPY anbaric-plugins/package.json anbaric-plugins/
COPY anbaric-services-client/package.json anbaric-services-client/
# The design system is a file: devDependency of anbaric-plugins, so npm ci
# needs it present; it is aliased away when plugins are bundled, never run.
COPY anbaric-design-system anbaric-design-system
RUN npm ci

COPY tsapi tsapi
COPY anbaric-state-machine anbaric-state-machine
COPY anbaric-impl-cloud anbaric-impl-cloud
COPY anbaric-cloud-hosting anbaric-cloud-hosting
COPY anbaric-cli anbaric-cli
COPY anbaric-data-store anbaric-data-store
COPY anbaric anbaric
COPY anbaric-hosting anbaric-hosting
COPY anbaric-plugins anbaric-plugins
COPY anbaric-services-client anbaric-services-client

EXPOSE 8787
CMD ["npx", "tsx", "anbaric-cloud-hosting/src/main.ts"]
