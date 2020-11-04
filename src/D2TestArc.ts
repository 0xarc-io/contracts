import { Signer, Wallet } from 'ethers';

import D2Arc from './D2Arc';
import { TestToken } from '@src/typings/TestToken';
import { ArcProxy, D2CoreV1, MockD2CoreV1, MockOracle, SyntheticToken } from '@src/typings';
import { SynthNames } from './D2Arc';
import { assert } from 'console';
import { BigNumberish } from 'ethers/utils';

export class D2TestArc extends D2Arc {
  static async init(signer: Signer): Promise<D2TestArc> {
    let arc = new D2TestArc();
    arc.signer = signer;
    arc.signerAddress = await signer.getAddress();
    return arc;
  }

  async deployTestArc() {
    const mockCore = await MockD2CoreV1.deploy(this.signer);

    const collateralAsset = await TestToken.deploy(this.signer, 'TestCollateral', 'TEST');
    const syntheticAsset = await SyntheticToken.deploy(this.signer, 'TESTUSD', 'TESTUSD');

    const oracle = await MockOracle.deploy(this.signer);
    const proxy = await ArcProxy.deploy(this.signer, mockCore.address, this.signerAddress, []);

    let core = await D2CoreV1.at(this.signer, proxy.address);

    await core.init(collateralAsset.address, syntheticAsset.address, oracle.address);
    await syntheticAsset.addMinter(core.address);

    await this.addSynths({ TESTUSD: core.address });
  }

  public synth() {
    return this.availableSynths()[0];
  }

  public async updatePrice(price: BigNumberish) {
    const mockOracle = await MockOracle.at(this.signer, this.synth().oracle.address);
    await mockOracle.setPrice({ value: price });
  }

  public async updateTime(value: BigNumberish) {
    const mockArc = await MockD2CoreV1.at(this.signer, this.synth().core.address);
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

  public coreAddress() {
    return this.synth().core.address;
  }

  public syntheticAddress() {
    return this.synth().synthetic.address;
  }
}
