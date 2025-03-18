/**
1. Gateway and Schema Configuration:
  - Reads the supergraph schema from "supergraph.graphql".
  - Creates an ApolloGateway instance using the schema, and configures each remote
    GraphQL service with RemoteGraphQLDataSource that puts
    user and cookies information into outgoing requests via headers.

2. Apollo Server Initialization:
  - Enables GraphQL Playground and introspection if in debug mode.
  - Instantiates an ApolloServer using the gateway. It adds plugin for:
    - ApolloServerPluginDrainHttpServer: Does graceful shutdown by draining the HTTP server.
    - ApolloServerPluginLandingPageDisabled: Disables the landing page in production.

3. Express Server and Middleware Setup:
  - Creates an Express app and an HTTP server to handle incoming requests.
  - Configures middleware for:
    - CORS: Restricts allowed origins taken from env (if it exists) or just to localhost.
    - Cookie Parsing: Enables access to cookies on incoming requests.
    - JSON Body Parsing: Processes JSON request bodies.
    - JWT Authentication: Uses express-jwt to decode JWT tokens from "Authorization" cookie, 
      making the user data available in the request.
    - Apollo Express Middleware: Connects the Apollo Server to the Express app,
      making the GraphQL context from the authenticated user and cookies.

4. Server Startup:
  - Starts the Apollo Server and attaches it to the Express middleware.
  - Begins listening on the configured port from env (if it exists) or port 80, logging a startup message indicating
    the port and debug mode status.
*/


import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloGateway, RemoteGraphQLDataSource } from "@apollo/gateway";
import { ApolloServerPluginLandingPageDisabled } from "@apollo/server/plugin/disabled";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";

import http from "http";
import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

import { readFileSync } from "fs";
import { expressjwt } from "express-jwt";

// gateway config
const debug = parseInt(process.env.GLOBAL_DEBUG || 1);
const port = process.env.GATEWAY_PORT || 80;
const jwt_secret =
  process.env.JWT_SECRET || "this-is-the-greatest-secret-of-all-time";
const corsOptions = {
  origin: (process.env.GATEWAY_ALLOWED_ORIGINS || "localhost 127.0.0.1").split(
    " "
  ),
  credentials: true,
};
const supergraphSchema = "./supergraph.graphql";

// instantiate express app
const app = express();

// httpServer handles incoming requests to the express app
// enable graceful shutdown by telling Apollo Server to drain the httpServer
const httpServer = http.createServer(app);

// instantiate gateway
const gateway = new ApolloGateway({
  supergraphSdl: readFileSync(supergraphSchema).toString(),
  buildService: ({ url }) =>
    new RemoteGraphQLDataSource({
      url,

      // pass user as context item
      willSendRequest: ({ request, context }) => {
        request.http.headers.set(
          "user",
          context.user ? JSON.stringify(context.user) : null
        );
        request.http.headers.set(
          "cookies",
          context.cookies ? JSON.stringify(context.cookies) : null
        );
      },
    }),
});

// instantiate server
const server = new ApolloServer({
  gateway: gateway,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    ...(debug ? [] : [ApolloServerPluginLandingPageDisabled()]), // disable landing page on prod
  ],
  playground: debug ? true : false, // disable introspection on prod
  introspection: debug ? true : false, // disable introspection on prod
});

// ensure we wait for server to start
await server.start();

// set up middleware
app.use(
  "/",
  cors(corsOptions),
  cookieParser(),
  bodyParser.json(),
  expressjwt({
    secret: jwt_secret,
    algorithms: ["HS256"],
    credentialsRequired: false,
    getToken: (req) => {
      // fetch token from cookie
      if ("Authorization" in req.cookies) {
        return req.cookies.Authorization;
      }
      return null;
    },
  }),
  expressMiddleware(server, {
    context: ({ req }) => ({
      user: req.auth || null,
      cookies: req.cookies || null,
    }),
  })
);

// modified server startup
await new Promise((resolve) => httpServer.listen({ port }, resolve));
console.log(`Gateway started at port ${port}. Debug: ${debug}`);
