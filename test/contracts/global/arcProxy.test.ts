import { ArcProxyFactory, SapphirePassportScoresFactory } from '@src/typings';
import {} from '@test/helpers';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import hre from 'hardhat';

describe('ArcProxy', () => {
  it('calls the init function of the target contract at deploy time', async () => {
    const [signer] = await hre.ethers.getSigners();

    const passportScoresImpl = await new SapphirePassportScoresFactory(
      signer,
    ).deploy();

    const initSelector = passportScoresImpl.interface.getSighash(
      passportScoresImpl.interface.functions[
        'init(bytes32,address,address,uint256)'
      ],
    );
    const encoder = new utils.AbiCoder();

    const data = utils.solidityPack(
      ['bytes4', 'bytes'],
      [
        initSelector,
        encoder.encode(
          ['bytes32', 'address', 'address', 'uint256'],
          [constants.HashZero, signer.address, signer.address, 21],
        ),
      ],
    );

    const proxy = await new ArcProxyFactory(signer).deploy(
      passportScoresImpl.address,
      signer.address,
      data,
    );

    const passport = SapphirePassportScoresFactory.connect(
      proxy.address,
      signer,
    );
    expect(await passport.getAdmin()).to.eq(signer.address);
    expect(await passport.currentEpoch()).to.eq(21);
  });
});
