import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloGateway, RemoteGraphQLDataSource } from "@apollo/gateway";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";

import http from "http";
import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

import { readFileSync } from "fs";
import { expressjwt } from "express-jwt";

// gateway config
const debug = parseInt(process.env.DEBUG);
const port = process.env.PORT || 80;
const jwt_secret = process.env.JWT_SECRET || "this-is-the-greatest-secret-of-all-time";
const corsOptions = {
    origin: (process.env.ALLOWED_ORIGINS || "localhost 127.0.0.1").split(" "),
    credentials: true,
};
const supergraphSchema = "/data/supergraph.graphql";

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
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    playground: debug ? true : false, // disable introspection on prod
    introspection: debug ? true: false, // disable introspection on prod
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
