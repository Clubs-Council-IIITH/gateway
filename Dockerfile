# cache dependencies
FROM node:20-slim AS node_cache
WORKDIR /cache
COPY package*.json .
RUN npm config set registry http://registry.npmjs.org/ --global
RUN npm install --prefer-offline --no-audit --progress=true --loglevel verbose --production

# build and start
FROM node:20-slim AS build
WORKDIR /gateway
ENV APOLLO_ELV2_LICENSE accept
COPY --from=node_cache /cache .
COPY . .
RUN tar -xvf ./composer/supergraph-bin.tar.gz -C ./node_modules/binary-install/node_modules/.bin
ENTRYPOINT [ "./entrypoint.sh" ]
