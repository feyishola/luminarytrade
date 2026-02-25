import { ApolloServer, ApolloServerOptions, BaseContext } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { GraphQLResolverMap } from "@apollo/subgraph/dist/schema-helper";
import { DocumentNode } from "graphql";
import { buildContext } from "./auth";
import { FederationContext } from "./types";

export interface SubgraphConfig {
  typeDefs: DocumentNode;
  resolvers: Record<string, unknown>;
  port: number;
  name: string;
  plugins?: ApolloServerOptions<BaseContext>["plugins"];
}

export async function createSubgraphServer(
  config: SubgraphConfig,
): Promise<ApolloServer<FederationContext>> {
  // buildSubgraphSchema only accepts a single { typeDefs, resolvers } object,
  // not the union type that Parameters<> was incorrectly resolving to.
  const schema = buildSubgraphSchema({
    typeDefs: config.typeDefs,
    resolvers: config.resolvers as GraphQLResolverMap<FederationContext>,
  });

  // ApolloServer must be typed with the context generic — using bare ApolloServer
  // (no generic) caused the "does not satisfy constraint" error.
  const server = new ApolloServer<FederationContext>({
    schema,
    plugins: config.plugins ?? [],
    formatError: (formattedError) => {
      if (
        process.env.NODE_ENV === "production" &&
        formattedError.extensions?.code === "INTERNAL_SERVER_ERROR"
      ) {
        return {
          message: "Internal server error",
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        };
      }
      return formattedError;
    },
  });

  await startStandaloneServer(server, {
    listen: { port: config.port },
    context: async ({ req }) => {
      return buildContext(req.headers as Record<string, string>);
    },
  });

  console.log(
    `🚀 ${config.name} subgraph ready at http://localhost:${config.port}/graphql`,
  );
  return server;
}
