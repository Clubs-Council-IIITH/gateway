import { ApolloServer } from "apollo-server";
import { ApolloGateway } from "@apollo/gateway";

const port = process.env.PORT || 8000;

const serviceList = [
    {
        name: "clubs",
        url: "http://clubs/graphql",
    },
];

const gateway = new ApolloGateway({
    serviceList: serviceList,
});

const server = new ApolloServer({
    gateway,
    subscriptions: false,
});

server
    .listen({ port: port })
    .then(({ url }) => console.info(`Gateway started at ${url}`))
    .catch((err) => console.error("Unable to start gateway", err));
