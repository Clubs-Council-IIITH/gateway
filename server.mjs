import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { ApolloGateway } from "@apollo/gateway";
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
  }),
});

const { url } = await startStandaloneServer(server, { listen: { port } });
console.log(`Gateway started at ${url}`);
