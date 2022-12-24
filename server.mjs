import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { ApolloGateway, RemoteGraphQLDataSource } from "@apollo/gateway";
import { watch } from "fs";
import { readFile } from "fs/promises";

const port = process.env.PORT || 8000;
const supergraphSchema = "/data/supergraph.graphql";

const server = new ApolloServer({
  gateway: new ApolloGateway({
    async supergraphSdl({ update, healthCheck }) {
      const watcher = watch(supergraphSchema);

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
  }),
});

const { url } = await startStandaloneServer(server, {
  listen: { port },
  context: async ({ req, res }) => {
    const user = {
      id: "0",
      firstName: "first",
      lastName: "last",
      email: "first.last@iiit.ac.in",
      role: "slc",
    };
    return { session: user };
  },
});

console.log(`Gateway started at ${url}`);
