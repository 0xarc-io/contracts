import { BigNumberish, Signer } from 'ethers';
import { SapphireArc } from './SapphireArc';
import { MockOracleFactory } from './typings';
import { MockSapphireCoreV1Factory } from './typings/MockSapphireCoreV1Factory';

export class SapphireTestArc extends SapphireArc {
  static new(signer: Signer): SapphireTestArc {
    return new SapphireTestArc(signer);
  }

  public synth() {
    return this.getSynth(this.getSynthNames()[0]);
  }

  public async updatePrice(price: BigNumberish) {
    const mockOracle = new MockOracleFactory(this.signer).attach(this.synth().oracle.address);
    await mockOracle.setPrice({ value: price });
  }

  public async updateTime(value: BigNumberish) {
    const mockArc = new MockSapphireCoreV1Factory(this.signer).attach(this.synth().core.address);
    await mockArc.setCurrentTimestamp(value);
  }

  public getSynthTotals() {
    return this.synth().core.getTotals();
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
