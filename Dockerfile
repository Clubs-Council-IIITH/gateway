# cache dependencies
FROM node:20-slim as node_cache
WORKDIR /cache/
COPY package*.json .
RUN npm config set registry http://registry.npmjs.org/ --global
# RUN npm prune --loglevel verbose
RUN npm install --prefer-offline --no-audit --progress=true --loglevel verbose --production

# build and start
FROM node:20-slim as build
WORKDIR /gateway
COPY --from=node_cache /cache/ .
COPY . .
ENTRYPOINT [ "npm", "start" ]