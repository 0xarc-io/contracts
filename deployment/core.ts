import { Wallet, ethers } from 'ethers';
import { AddressBook } from '../src/addresses/AddressBook';
import { Config } from '../src/addresses/Config';

import { CoreV1 } from '../src/typings/CoreV1';
import { Proxy } from '../src/typings/Proxy';
import { LendShare } from '../src/typings/LendShare';
import { SyntheticToken } from '../src/typings/SyntheticToken';
import { StateV1 } from '../src/typings/StateV1';
import { MockOracle } from '../src/typings/MockOracle';
import { ChainLinkOracle } from '../src/typings/ChainLinkOracle';
import { TestToken } from '../src/typings';

export class CoreStage {
  wallet: Wallet;
  addressBook: AddressBook;
  config: Config;

  constructor(wallet: Wallet, addressBook: AddressBook, config: Config) {
    this.wallet = wallet;
    this.addressBook = addressBook;
    this.config = config;
  }

  async deployAll(): Promise<AddressBook> {
    if (!this.addressBook.coreV1) {
      await this.deployCore();
    }

    if (!this.addressBook.proxy) {
      await this.deployProxy();
    }

    if (!this.addressBook.syntheticToken) {
      await this.deploySynthetic();
    }

    this.addressBook.collateralAsset = this.addressBook.collateralAsset || this.config.stableShare;
    if (!this.addressBook.collateralAsset) {
      await this.deployCollateralAsset();
    }

    this.addressBook.oracle = this.addressBook.oracle || this.config.oracle;
    if (!this.addressBook.oracle) {
      await this.deployOracle();
    }

    if (!this.addressBook.stateV1) {
      await this.deployState();
    }

    await this.initState();

    await this.transferOwnership();

    return this.addressBook;
  }

  async transferOwnership() {}

  async deployCore() {
    console.log('*** Deploying Core *** ');
    const contract = await CoreV1.awaitDeployment(this.wallet);
    this.addressBook.coreV1 = contract.address;
  }

  async deployProxy() {
    console.log('*** Deploying Proxy *** ');
    const contract = await Proxy.awaitDeployment(this.wallet);
    console.log('** Setting pending implementation **');
    await contract.setPendingImplementation(this.addressBook.coreV1);
    console.log('** Accepting pending implementation **');
    await contract.acceptImplementation({
      gasLimit: 5000000,
    });
    this.addressBook.proxy = contract.address;
  }

  async deployCollateralAsset() {
    console.log('*** Deploying Synthetic Asset *** ');
    const contract = await TestToken.awaitDeployment(this.wallet, 'LINK', 'LINK');
    this.addressBook.collateralAsset = contract.address;
  }

  async deploySynthetic() {
    console.log('*** Deploying Collateral Asset *** ');
    const contract = await SyntheticToken.awaitDeployment(
      this.wallet,
      this.addressBook.proxy,
      this.config.name,
      this.config.symbol,
    );
    this.addressBook.syntheticToken = contract.address;
  }

  async deployOracle() {
    console.log('*** Deploying Mock Oracle *** ');
    if (this.config.chainlinkAggregator) {
      const contract = await ChainLinkOracle.awaitDeployment(
        this.wallet,
        this.config.chainlinkAggregator,
      );
      this.addressBook.oracle = contract.address;
    } else {
      const contract = await MockOracle.awaitDeployment(this.wallet);
      this.addressBook.oracle = contract.address;
    }
  }

  async deployState() {
    console.log('*** Deploying State *** ');
    const contract = await StateV1.deploy(this.wallet, this.addressBook.proxy, this.config.owner, {
      syntheticAsset: this.addressBook.syntheticToken,
      collateralAsset: this.addressBook.collateralAsset,
      collateralRatio: { value: this.config.collateralRatio },
      syntheticRatio: { value: this.config.syntheticRatio },
      liquidationSpread: { value: this.config.liquidationSpread },
      originationFee: { value: this.config.originationFee },
      oracle: this.addressBook.oracle,
    });
    this.addressBook.stateV1 = contract.address;
  }

  async initState() {
    console.log('*** Initing State *** ');
    const contract = await CoreV1.at(this.wallet, this.addressBook.proxy);

    if ((await contract.state()) == ethers.constants.AddressZero) {
      await contract.init(this.addressBook.stateV1);
    }

    if (
      (await contract.stableLimit()).toString() == '0' &&
      (await contract.syntheticLimit()).toString() == '0'
    ) {
      console.log('** Setting Limits **');
      await contract.setLimits(this.config.stableAssetLimit, this.config.syntheticAssetLimit);
    }
  }
}
