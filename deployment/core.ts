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

    this.addressBook.collateralAsset =
      this.addressBook.collateralAsset || this.config.collateralAsset;
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
    const address = await this.wallet.getAddress();
    const contract = await Proxy.awaitDeployment(
      this.wallet,
      this.addressBook.coreV1,
      address,
      [],
      {
        gasLimit: 5000000,
      },
    );
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
    const contract = await StateV1.deploy(
      this.wallet,
      this.addressBook.proxy,
      this.config.owner,
      this.addressBook.collateralAsset,
      this.addressBook.syntheticToken,
      this.addressBook.oracle,
      {
        collateralRatio: { value: this.config.collateralRatio },
        liquidationArcFee: { value: this.config.liquidationArcFee },
        liquidationUserFee: { value: this.config.liquidationUserFee },
        interestRate: { value: this.config.interestRate },
      },
      {
        collateralLimit: this.config.collateralLimit,
        syntheticLimit: this.config.syntheticAssetLimit,
        positionCollateralMinimum: this.config.positionCollateralMinimum,
      },
    );
    this.addressBook.stateV1 = contract.address;
  }

  async initState() {
    console.log('*** Initing State *** ');
    const contract = await CoreV1.at(this.wallet, this.addressBook.proxy);

    if ((await contract.state()) == ethers.constants.AddressZero) {
      await contract.init(this.addressBook.stateV1);
    }
  }
}
