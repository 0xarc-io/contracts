import { Signer } from 'ethers';

import { MozartArc } from './MozartArc';
import { BigNumberish } from 'ethers';
import { MockOracleFactory } from './typings/MockOracleFactory';
import { MockMozartV1Factory } from './typings/MockMozartV1Factory';

export class MozartTestArc extends MozartArc {
  static async init(signer: Signer): Promise<MozartTestArc> {
    const arc = new MozartTestArc();
    arc.signer = signer;
    arc.signerAddress = await signer.getAddress();
    return arc;
  }

  public synth() {
    return this.availableSynths()[0];
  }

  public async updatePrice(price: BigNumberish) {
    const mockOracle = await new MockOracleFactory(this.signer).attach(this.synth().oracle.address);
    await mockOracle.setPrice({ value: price });
  }

  public async updateTime(value: BigNumberish) {
    const mockArc = await new MockMozartV1Factory(this.signer).attach(this.synth().core.address);
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
