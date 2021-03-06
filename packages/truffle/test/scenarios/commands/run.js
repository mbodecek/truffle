const assert = require("assert");
const CommandRunner = require("../commandrunner");
const MemoryLogger = require("../memorylogger");
const sandbox = require("../sandbox");
const path = require("path");

const logger = new MemoryLogger();
let config, project;

const loadSandboxLogger = source => {
  project = path.join(__dirname, source);
  return sandbox.load(project).then(conf => {
    config = conf;
    config.logger = logger;
  });
};

describe("truffle run [ @standalone ]", () => {
  describe("when run without arguments", () => {
    beforeEach(() => {
      return loadSandboxLogger("../../sources/run/mockProjectWithPlugin");
    });

    it("displays general help", async () => {
      await CommandRunner.run("run", config);
      const output = logger.contents();
      assert(output.includes("Usage:        truffle run [<command>]"));
    }).timeout(60000);

    it("should not error", async () => {
      await CommandRunner.run("run", config);
    }).timeout(60000);
  });

  describe("when run with an argument", () => {
    describe("without plugins configured", () => {
      before(() => {
        return loadSandboxLogger("../../sources/run/mockProjectWithoutPlugin");
      });

      it("whines about having no plugins configured", async () => {
        await CommandRunner.run("run mock", config);
        const output = logger.contents();
        assert(output.includes("Error: No plugins detected"));
      }).timeout(30000);
    });

    describe("with plugins configured", () => {
      describe("error handling", () => {
        it("throws error when plugins formatted incorrectly", async () => {
          await loadSandboxLogger(
            "../../sources/run/mockProjectWithBadPluginFormat"
          );
          try {
            await CommandRunner.run("run mock", config);
          } catch (_error) {
            const output = logger.contents();
            assert(output.includes("Error: Plugins configured incorrectly."));
          }
        }).timeout(30000);

        it("throws error when plugins configured but not installed", async () => {
          await loadSandboxLogger(
            "../../sources/run/mockProjectWithMissingPluginModule"
          );
          try {
            await CommandRunner.run("run mock", config);
          } catch (_error) {
            const output = logger.contents();
            assert(output.includes("listed as a plugin, but not found"));
          }
        }).timeout(30000);

        it("throws error when plugins are missing truffle-plugin.json", async () => {
          await loadSandboxLogger(
            "../../sources/run/mockProjectWithMissingPluginConfig"
          );
          try {
            await CommandRunner.run("run mock", config);
          } catch (_error) {
            const output = logger.contents();
            assert(output.includes("Error: truffle-plugin.json not found"));
          }
        }).timeout(30000);

        it("throws error when configured/installed plugins don't support the given arg/command", async () => {
          await loadSandboxLogger("../../sources/run/mockProjectWithPlugin");
          try {
            await CommandRunner.run("run mock", config);
          } catch (_error) {
            const output = logger.contents();
            assert(output.includes("command not supported"));
          }
        }).timeout(60000);

        it("throws error if command in truffle-plugin.json uses an absolute path", async () => {
          await loadSandboxLogger(
            "../../sources/run/mockProjectWithAbsolutePath"
          );
          try {
            await CommandRunner.run("run mock", config);
          } catch (_error) {
            const output = logger.contents();
            assert(output.includes("Error: Absolute paths not allowed!"));
          }
        }).timeout(30000);
      });

      describe("when plugins configured and installed that support a given argument", () => {
        before(() => {
          return loadSandboxLogger(
            "../../sources/run/mockProjectWithWorkingPlugin"
          );
        });

        it("runs the command script", async () => {
          await CommandRunner.run("run mock", config);
          const output = logger.contents();
          assert(output.includes("Running truffle-mock!"));
        }).timeout(60000);

        it("does not warn about unsupported options", async () => {
          await CommandRunner.run("run mock --option value", config);
          const output = logger.contents();
          assert(!output.includes("Warning:"));
        }).timeout(60000);
      });
    });
  }).timeout(30000);
});
