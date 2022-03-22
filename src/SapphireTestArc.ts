import { BigNumberish, Signer } from 'ethers';
import { SapphireArc } from './SapphireArc';
import { MockSapphireCoreV1Factory } from './typings/MockSapphireCoreV1Factory';
import { MockSapphireOracleFactory } from './typings/MockSapphireOracleFactory';

export class SapphireTestArc extends SapphireArc {
  static new(signer: Signer): SapphireTestArc {
    return new SapphireTestArc(signer);
  }

  coreContracts() {
    return this.getCoreContracts(this.getCoreNames()[0]);
  }

  async updatePrice(price: BigNumberish) {
    const mockOracle = new MockSapphireOracleFactory(this.signer).attach(
      this.coreContracts().oracle.address,
    );
    await mockOracle.setPrice(price);
  }

  async updateTime(value: BigNumberish) {
    const mockArc = new MockSapphireCoreV1Factory(this.signer).attach(
      this.coreContracts().core.address,
    );
    await mockArc.setCurrentTimestamp(value);

    // Set the timestamp of the oracle
    await this.setOracleTimestamp(value);
  }

  async setOracleTimestamp(value: BigNumberish) {
    const mockOracle = new MockSapphireOracleFactory(this.signer).attach(
      await this.coreContracts().core.oracle(),
    );
    await mockOracle.setTimestamp(value);
  }

  core() {
    return this.coreContracts().core;
  }

  pool() {
    return this.coreContracts().pool;
  }

  collateral() {
    return this.coreContracts().collateral;
  }

  assessor() {
    return this.coreContracts().assessor;
  }

  coreAddress() {
    return this.coreContracts().core.address;
  }
}
