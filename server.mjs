import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloGateway, RemoteGraphQLDataSource } from "@apollo/gateway";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";

import { watch } from "fs";
import { readFile } from "fs/promises";

import express from "express";
import { expressjwt } from "express-jwt";

import http from "http";
import cors from "cors";
import bodyParser from "body-parser";

// server config
const port = process.env.GATEWAY_PORT || 8000;
const secret = process.env.GATEWAY_SECRET || "This-is-my-secret";
const supergraphSchema = "/data/supergraph.graphql";
const corsOptions = {
  origin: (process.env.GATEWAY_ALLOWED_ORIGINS || "0.0.0.0 localhost 127.0.0.1").split(" "),
  credentials: true,
};

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

      // pass user as context item
      willSendRequest({ request, context }) {
        request.http.headers.set(
          "user",
          context.user ? JSON.stringify(context.user) : null
        );
      },

      // forward all headers from subgraphs
      didReceiveResponse({ response, context }) {
        const headers = response?.http?.headers;
        headers?.forEach((value, key) => {
          context?.res?.setHeader?.(key, value);
        });
        return response;
      },
    });
  },
});

// set up express server
const app = express();

// set up HTTP server
const httpServer = http.createServer(app);
const server = new ApolloServer({
  gateway: gateway,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })], // for graceful shutdown
});

// wait for server to start
await server.start();

// add middleware
app.use(
  "/",
  cors(corsOptions),
  bodyParser.json(),
  expressjwt({
    secret: secret,
    algorithms: ["HS256"],
    credentialsRequired: false,
  }),
  expressMiddleware(server, {
    context: ({ req, res }) => {
      const user = req.auth || null;
      return { user, req, res };
    },
  })
);

// modified server startup
await new Promise((resolve) => httpServer.listen({ port: port }, resolve));
console.log(`Gateway started at port ${port}.`);
