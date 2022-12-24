import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloGateway, RemoteGraphQLDataSource } from "@apollo/gateway";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";

import { watch } from "fs";
import { readFile } from "fs/promises";

import http from "http";
import cors from "cors";
import express from "express";
import bodyParser from "body-parser";

const port = process.env.PORT || 8000;
const supergraphSchema = "/data/supergraph.graphql";

// instantiate gateway
const gateway = new ApolloGateway({
  async supergraphSdl({ update, healthCheck }) {
    const watcher = watch(supergraphSchema);

    // reload supergraph on update
    watcher.on("change", async () => {
      try {
        const updatedSupergraph = await readFile(supergraphSchema);
        await healthCheck(updatedSupergraph);
        update(updatedSupergraph);
      } catch (e) {
        console.error(e);
      }
    });

    return {
      supergraphSdl: await readFile(supergraphSchema, "utf-8"),
      async cleanup() {
        watcher.close();
      },
    };
  },

  buildService({ url }) {
    return new RemoteGraphQLDataSource({
      url,
      willSendRequest({ request, context }) {
        console.log(context);
        request.http.headers.set(
          "session",
          context.session ? JSON.stringify(context.session) : null
        );
      },
    });
  },
});

// set up express server
const app = express();
const httpServer = http.createServer(app);
const server = new ApolloServer({
  gateway: gateway,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })], // for graceful shutdown
});

// wait for server to start
await server.start();

// handle CORS, body parsing and expressMiddleware
app.use(
  "/",
  cors(),
  bodyParser.json(),
  expressMiddleware(server, {
    context: async ({ req }) => ({
      user: {
        id: "0",
        firstName: "first",
        lastName: "last",
        email: "first.last@iiit.ac.in",
        role: "slc",
      },
    }),
  })
);

// modified server startup
await new Promise((resolve) => httpServer.listen({ port: port }, resolve));
console.log(`Gateway started at port ${port}.`);
