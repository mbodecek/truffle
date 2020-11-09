import { logger } from "@truffle/db/logger";
const debug = logger("db:project:names:nameRecords");

import { IdObject, generate } from "@truffle/db/project/process";
import * as Batch from "./batch";

export const generateNameRecordsLoad = Batch.generate<{
  assignment: {
    name: string;
    type: string;
    current: IdObject<DataModel.NameRecord> | undefined;
  };
  properties: {
    nameRecord: IdObject<DataModel.NameRecord>;
  };
  entry: DataModel.NameRecordInput;
  result: IdObject<DataModel.NameRecord>;
}>({
  extract<_I>({ input: { resource, name, type, current } }) {
    return { resource, name, type, previous: current };
  },

  *process({ batch }) {
    debug("batch %o", batch);
    return yield* generate.load("nameRecords", batch);
  },

  convert<_I, _O>({ result, input }) {
    debug("converting %o", result);
    return {
      ...input,
      nameRecord: result
    };
  }
});
