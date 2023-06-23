# cache dependencies
FROM node:20-slim as node_cache
WORKDIR /cache
COPY package*.json .
RUN npm config set registry http://registry.npmjs.org/ --global
RUN npm install --prefer-offline --no-audit --progress=true --loglevel verbose --production

# construct supergraph
# FROM debian:bullseye-slim as supergraph
# WORKDIR /gateway
# COPY --from=node_cache /cache .
# COPY . .
# # ENTRYPOINT [ "npm", "start" ]
# CMD [ "sleep", "infinity" ]

# COPY supergraph.yml .
# RUN apt-get update && apt-get install -y curl
# RUN curl -sSL https://rover.apollo.dev/nix/v0.16.0 | sh
# ENV PATH="$HOME/.rover/bin:$PATH"
# CMD [ "sleep", "infinity" ]

# build and start
FROM node:20-slim as build
WORKDIR /gateway
ENV APOLLO_ELV2_LICENSE accept
COPY --from=node_cache /cache .
COPY . .
RUN apt-get update && apt-get install -y ca-certificates
ENTRYPOINT [ "./entrypoint.sh" ]
