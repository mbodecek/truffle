import { logger } from "@truffle/db/logger";
const debug = logger("db:project:compile:bytecodes");

import { IdObject, generate } from "@truffle/db/project/process";
import * as Batch from "./batch";

export const generateBytecodesLoad = Batch.Contracts.generate<{
  compilation: {};
  contract: {
    bytecode: DataModel.BytecodeInput;
    deployedBytecode: DataModel.BytecodeInput;
  };
  resources: {
    callBytecode: IdObject<DataModel.Bytecode>;
    createBytecode: IdObject<DataModel.Bytecode>;
  };
  entry: {
    callBytecode: DataModel.BytecodeInput;
    createBytecode: DataModel.BytecodeInput;
  };
  result: {
    callBytecode: IdObject<DataModel.Bytecode>;
    createBytecode: IdObject<DataModel.Bytecode>;
  };
}>({
  extract<_I>({
    input: { bytecode: createBytecode, deployedBytecode: callBytecode }
  }) {
    return {
      createBytecode,
      callBytecode
    };
  },

  *process({ batch }) {
    const callBytecodes = yield* generate.load(
      "bytecodes",
      batch.map(({ callBytecode }) => callBytecode)
    );

    const createBytecodes = yield* generate.load(
      "bytecodes",
      batch.map(({ createBytecode }) => createBytecode)
    );

    return callBytecodes.map((callBytecode, index) => ({
      callBytecode,
      createBytecode: createBytecodes[index]
    }));
  },

  convert<_I, _O>({
    result: { callBytecode, createBytecode },
    input: contract
  }) {
    return {
      ...contract,
      db: {
        ...contract.db,
        callBytecode,
        createBytecode
      }
    };
  }
});
