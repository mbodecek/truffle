const path = require("path");
const Deployer = require("@truffle/deployer");
const Require = require("@truffle/require");
const Emittery = require("emittery");
const { createInterfaceAdapter } = require("@truffle/interface-adapter");

const ResolverIntercept = require("./resolverintercept");

class Migration {
  constructor(file, reporter, config) {
    this.file = path.resolve(file);
    this.reporter = reporter;
    this.number = parseInt(path.basename(file));
    this.emitter = new Emittery();
    this.isFirst = false;
    this.isLast = false;
    this.dryRun = config.dryRun;
    this.interactive = config.interactive;
    this.config = config || {};
  }

  // ------------------------------------- Private -------------------------------------------------
  /**
   * Loads & validates migration, then runs it.
   * @param  {Object}   options  config and command-line
   * @param  {Object}   context  migrations script context
   * @param  {Object}   deployer truffle module
   * @param  {Object}   resolver truffle module
   * @param  {Object}   interfaceAdapter interfaceAdapter
   */
  async _load(options, context, deployer, resolver, interfaceAdapter) {
    // Load assets and run `execute`
    const accounts = await interfaceAdapter.getAccounts(options);
    const requireOptions = {
      file: this.file,
      context,
      resolver,
      args: [deployer]
    };

    const fn = Require.file(requireOptions);

    const unRunnable = !fn || !fn.length || fn.length == 0;

    if (unRunnable) {
      const msg = `Migration ${
        this.file
      } invalid or does not take any parameters`;
      throw new Error(msg);
    }

    // `migrateFn` might be sync or async. We negotiate that difference in
    // `execute` through the deployer API.
    const migrateFn = fn(deployer, options.network, accounts);
    await this._deploy(
      options,
      deployer,
      resolver,
      migrateFn,
      interfaceAdapter
    );
  }

  /**
   * Initiates deployer sequence, then manages migrations info
   * publication to chain / artifact saving.
   * @param  {Object}   options     config and command-line
   * @param  {Object}   deployer    truffle module
   * @param  {Object}   resolver    truffle module
   * @param  {[type]}   migrateFn   module.exports of a migrations.js
   * @param  {Object}   interfaceAdapter interfaceAdapter
   */
  async _deploy(options, deployer, resolver, migrateFn, interfaceAdapter) {
    const { web3, tezos } = interfaceAdapter;
    try {
      await deployer.start();

      // Allow migrations method to be async and
      // deploy to use await
      if (migrateFn && migrateFn.then !== undefined) {
        await deployer.then(() => migrateFn);
      }

      // Migrate without saving
      if (options.save === false) return;

      let Migrations;

      // Attempt to write migrations record to chain
      try {
        Migrations = resolver.require("Migrations");
      } catch (error) {
        // do nothing, Migrations contract optional
      }

      if (Migrations && Migrations.isDeployed() && options.force === false) {
        const message = `Saving migration to chain.`;

        if (!this.dryRun) {
          const data = { message };
          await this.emitter.emit("startTransaction", data);
        }

        const migrations = await Migrations.deployed();

        let receipt;
        if (web3) receipt = await migrations.setCompleted(this.number);
        if (tezos) receipt = await migrations.default(this.number);

        if (!this.dryRun) {
          const data = { receipt, message };
          await this.emitter.emit("endTransaction", data);
        }
      }

      if (web3) await this.emitter.emit("postEvmMigrate", this.isLast);
      if (tezos) await this.emitter.emit("postTezosMigrate", this.isLast);

      // Save artifacts to local filesystem
      await options.artifactor.saveAll(resolver.contracts());

      deployer.finish();

      // Cleanup
      if (this.isLast) {
        this.emitter.clearListeners();

        // Exiting w provider-engine appears to be hopeless. This hack on
        // our fork just swallows errors from eth-block-tracking
        // as we unwind the handlers downstream from here.
        if (this.config.provider && this.config.provider.engine) {
          this.config.provider.engine.silent = true;
        }
      }
    } catch (error) {
      const payload = {
        type: "migrateErr",
        error
      };

      await this.emitter.emit("error", payload);
      deployer.finish();
      throw error;
    }
  }

  // ------------------------------------- Public -------------------------------------------------
  /**
   * Instantiates a deployer, connects this migration and its deployer to the reporter
   * and launches a migration file's deployment sequence
   * @param  {Object}   options  config and command-line
   */
  async run(options) {
    const {
      interfaceAdapter,
      resolver,
      context,
      deployer
    } = this.prepareForMigrations(options);

    // Connect reporter to this migration
    if (this.reporter) {
      this.reporter.setMigration(this);
      this.reporter.setDeployer(deployer);
      this.reporter.confirmations = options.confirmations || 0;
      this.reporter.listen();
    }

    // Get file path and emit pre-migration event
    const file = path.relative(options.migrations_directory, this.file);
    const { gasLimit } = await interfaceAdapter.getBlock("latest");

    const preMigrationsData = {
      file: file,
      number: this.number,
      isFirst: this.isFirst,
      network: options.network,
      networkId: options.network_id,
      blockLimit: gasLimit
    };

    await this.emitter.emit("preMigrate", preMigrationsData);
    await this._load(options, context, deployer, resolver, interfaceAdapter);
  }

  prepareForMigrations(options) {
    const logger = options.logger;
    const interfaceAdapter = createInterfaceAdapter({
      provider: options.provider,
      networkType: options.networks[options.network].type
        ? options.networks[options.network].type
        : "web3js"
    });

    const resolver = new ResolverIntercept(options.resolver);

    // Initial context.
    const context = {
      web3: interfaceAdapter.web3 ? interfaceAdapter.web3 : undefined,
      tezos: interfaceAdapter.tezos ? interfaceAdapter.tezos : undefined,
      config: this.config
    };

    const deployer = new Deployer({
      logger,
      confirmations: options.confirmations,
      timeoutBlocks: options.timeoutBlocks,
      networks: options.networks,
      network: options.network,
      network_id: options.network_id,
      provider: options.provider,
      basePath: path.dirname(this.file),
      ens: options.ens
    });

    return { interfaceAdapter, resolver, context, deployer };
  }

  /**
   * Returns a serializable version of `this`
   * @returns  {Object}
   */
  serializeable() {
    return {
      file: this.file,
      number: this.number,
      isFirst: this.isFirst,
      isLast: this.isLast,
      dryRun: this.dryRun,
      interactive: this.interactive
    };
  }
}

module.exports = Migration;
