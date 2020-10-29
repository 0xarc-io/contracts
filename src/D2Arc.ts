import { Signer } from 'ethers';
export default class D2Arc {
  public wallet: Signer;

  static async init(wallet: Signer, addressBook): Promise<D2Arc> {
    let arc = new D2Arc();
    arc.wallet = wallet;

    return arc;
  }
}
