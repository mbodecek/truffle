import { logger } from "@truffle/db/logger";
const debug = logger("db:project:names:resources");

import gql from "graphql-tag";
import pascalCase from "pascal-case";
import { singular } from "pluralize";
import {
  IdObject,
  generate,
  NamedCollectionName
} from "@truffle/db/project/process";
import * as Batch from "./batch";

export const generateResourceNames = Batch.generate<{
  assignment: {};
  properties: {
    name: string;
    type: string;
  };
  entry: IdObject;
  result: {
    name: string;
    type: string;
  };
}>({
  extract<_I>({ input: { resource } }) {
    return resource;
  },

  *process({ entries, inputs: { collectionName } }) {
    const type = pascalCase(singular(collectionName));

    const resources = yield* generate.find(
      collectionName as NamedCollectionName,
      entries.map(({ id }) => id),
      gql`
        fragment ${type}Name on ${type} {
          name
        }
      `
    );

    return resources.map(({ name }) => ({ name, type }));
  },

  convert<_I, _O>({ result, input }) {
    return {
      ...input,
      ...result
    };
  }
});
