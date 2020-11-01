import { Wallet } from 'ethers';
import D2Arc from './D2Arc';
import { TestToken } from '@src/typings/TestToken';
import { ArcProxy, D2CoreV1, MockD2CoreV1, MockOracle, SyntheticToken } from '@src/typings';
import { SynthNames } from './D2Arc';
import { assert } from 'console';
import { BigNumberish } from 'ethers/utils';

export class D2TestArc extends D2Arc {
  static async init(wallet: Wallet): Promise<D2TestArc> {
    let arc = new D2TestArc();
    arc.wallet = wallet;
    arc.walletAddress = await wallet.getAddress();
    return arc;
  }

  async deployTestArc() {
    const mockCore = await MockD2CoreV1.deploy(this.wallet);

    const collateralAsset = await TestToken.deploy(this.wallet, 'TestCollateral', 'TEST');
    const syntheticAsset = await SyntheticToken.deploy(this.wallet, 'TESTUSD', 'TESTUSD');

    const oracle = await MockOracle.deploy(this.wallet);
    const proxy = await ArcProxy.deploy(this.wallet, mockCore.address, this.walletAddress, []);

    let core = await D2CoreV1.at(this.wallet, proxy.address);

    await core.init(collateralAsset.address, syntheticAsset.address, oracle.address);
    await syntheticAsset.addMinter(core.address);

    await this.addSynths({ TESTUSD: core.address });
  }

  public synth() {
    return this.availableSynths()[0];
  }

  public async updatePrice(price: BigNumberish) {
    const mockOracle = await MockOracle.at(this.wallet, this.synth().oracle.address);
    await mockOracle.setPrice({ value: price });
  }

  public async updateTime(value: BigNumberish) {
    const mockArc = await MockD2CoreV1.at(this.wallet, this.synth().core.address);
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
