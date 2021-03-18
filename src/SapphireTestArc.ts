import { BigNumberish } from 'ethers';
import { SapphireArc } from './SapphireArc';
import { MockOracleFactory } from './typings';
import { MockSapphireCoreFactory } from './typings/MockSapphireCoreFactory';

export class SapphireTestArc extends SapphireArc {
  public synth() {
    return this.getSynth(this.getSynthNames()[0]);
  }


  public async updatePrice(price: BigNumberish) {
    const mockOracle = new MockOracleFactory(this.signer).attach(this.synth().oracle.address);
    await mockOracle.setPrice({ value: price });
  }

  public async updateTime(value: BigNumberish) {
    const mockArc = new MockSapphireCoreFactory(this.signer).attach(
      this.synth().core.address,
    );
    await mockArc.setCurrentTimestamp(value);
  }

  public async getSynthTotals() {
    return await this.synth().core.getTotals();
  }

  public async getPosition(id: BigNumberish) {
    return await this.synth().core.getPosition(id);
  }

  public core() {
    return this.synth().core;
  }

  public synthetic() {
    return this.synth().synthetic;
  }

  public collateral() {
    return this.synth().collateral;
  }

  public coreAddress() {
    return this.synth().core.address;
  }

  public syntheticAddress() {
    return this.synth().synthetic.address;
  }
}
