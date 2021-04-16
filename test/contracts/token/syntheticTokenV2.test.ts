import 'module-alias/register';
import { expect, util } from 'chai';
import { deployArcProxy, deploySyntheticTokenV2 } from '../deployers';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expectRevert } from '../../helpers/expectRevert';
import { BigNumber } from '@ethersproject/bignumber';
import { SyntheticTokenV2 } from '@src/typings/SyntheticTokenV2';
import { constants, utils } from 'ethers';
import { signPermit } from '@src/utils/signPermit';
import hre from 'hardhat';
import { SyntheticTokenV2__factory } from '@src/typings';

describe('SyntheticTokenV2', () => {
  let syntheticToken: SyntheticTokenV2;
  let ownerAccount: SignerWithAddress;
  let arcAccount: SignerWithAddress;
  let arcAccount1: SignerWithAddress;
  let arcAccount2: SignerWithAddress;
  let userAccount: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  function getContract(caller: SignerWithAddress) {
    return SyntheticTokenV2__factory.connect(syntheticToken.address, caller);
  }

  before(async () => {
    const signers = await ethers.getSigners();
    ownerAccount = signers[0];
    arcAccount = signers[1];
    userAccount = signers[2];
    otherAccount = signers[3];
    arcAccount1 = signers[4];
    arcAccount2 = signers[5];

    const synthImpl = await deploySyntheticTokenV2(ownerAccount, 'ARCx', '1');

    const proxy = await deployArcProxy(
      ownerAccount,
      synthImpl.address,
      ownerAccount.address,
      [],
    );

    syntheticToken = SyntheticTokenV2__factory.connect(
      proxy.address,
      ownerAccount,
    );
    await syntheticToken.init('ARCx', 'ARCx', '1');

    // Add arc account as minter
    await syntheticToken.addMinter(arcAccount.address, 20);

    const minterContract = await getContract(arcAccount);
    await minterContract.mint(userAccount.address, 10);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('view functions', () => {
    describe('#decimals', () => {
      it('returns 18 decimals', async () => {
        expect(await syntheticToken.decimals()).to.eq(18);
      });
    });

    describe('#getAllMinters', () => {
      it('returns all minters', async () => {
        let minters = await syntheticToken.getAllMinters();
        expect(minters).to.have.length(1);
        expect(minters[0]).to.eq(arcAccount.address);

        await syntheticToken.addMinter(arcAccount1.address, 21);

        minters = await syntheticToken.getAllMinters();

        expect(minters).to.have.length(2);
        expect(minters[1]).to.eq(arcAccount1.address);
      });
    });

    describe('#isValidMinter', () => {
      it('returns true if minter is valid', async () => {
        expect(await syntheticToken.isValidMinter(arcAccount.address)).to.be
          .true;
        expect(await syntheticToken.isValidMinter(arcAccount1.address)).to.be
          .false;

        await syntheticToken.addMinter(arcAccount1.address, 21);

        expect(await syntheticToken.isValidMinter(arcAccount.address)).to.be
          .true;
        expect(await syntheticToken.isValidMinter(arcAccount1.address)).to.be
          .true;
      });
    });

    describe('#getMinterIssued', () => {
      it('returns the amount of synth issued for the given minter', async () => {
        let amtIssued = await syntheticToken.getMinterIssued(
          arcAccount.address,
        );

        expect(amtIssued).to.eq(10);

        await syntheticToken.addMinter(arcAccount1.address, 15);

        const minterContract = getContract(arcAccount1);
        await minterContract.mint(userAccount.address, 12);

        amtIssued = await syntheticToken.getMinterIssued(arcAccount1.address);
        expect(amtIssued).to.eq(12);
      });
    });
  });

  describe('mutative functions', () => {
    describe('#init', () => {
      it('reverts if called twice', async () => {
        await expect(
          syntheticToken.init('abc', 'abc', '21'),
        ).to.be.revertedWith('SyntheticTokenV2: cannot be initialized twice');
      });

      it('initializes token with name, symbol and version', async () => {
        // the synth had already been initialized in the before function
        const name = await syntheticToken.name();
        const symbol = await syntheticToken.symbol();
        const version = await syntheticToken.version();
        const domainSeparator = await syntheticToken.DOMAIN_SEPARATOR();

        expect(name).to.eq('ARCx');
        expect(symbol).to.eq('ARCx');
        expect(version).to.eq('1');
        expect(domainSeparator).to.not.be.empty;
      });

      it('emits InitCalled', async () => {
        const synthImpl = await deploySyntheticTokenV2(
          ownerAccount,
          'ARCx',
          '1',
        );
        const proxy = await deployArcProxy(
          ownerAccount,
          synthImpl.address,
          ownerAccount.address,
          [],
        );

        const synthProxy = SyntheticTokenV2__factory.connect(
          proxy.address,
          ownerAccount,
        );

        await expect(synthProxy.init('ARCx', 'ARCx', '1'))
          .to.emit(synthProxy, 'InitCalled')
          .withArgs('ARCx', 'ARCx', '1');
      });
    });

    describe('#mint', () => {
      before(async () => {
        const currentLimit = await syntheticToken.getMinterLimit(
          arcAccount.address,
        );
        const issued = await syntheticToken.getMinterIssued(arcAccount.address);
        expect(currentLimit.sub(issued)).to.equal(10);
      });

      it('should not be able to mint as an unauthorised user', async () => {
        const contract = await getContract(userAccount);

        await expect(contract.mint(userAccount.address, 10)).to.be.revertedWith(
          'SyntheticTokenV2: only callable by minter',
        );
      });

      it('should be able to mint as arc', async () => {
        const contract = await getContract(arcAccount);
        await contract.mint(arcAccount.address, 9);
        expect(
          await (await syntheticToken.balanceOf(arcAccount.address)).toNumber(),
        ).to.equal(9);
      });

      it('mints to the limit', async () => {
        const contract = await getContract(arcAccount);
        await contract.mint(arcAccount.address, 10);

        expect(
          await (await syntheticToken.balanceOf(arcAccount.address)).toNumber(),
        ).to.equal(10);

        const issuance = await syntheticToken.getMinterIssued(
          arcAccount.address,
        );
        expect(issuance).to.equal(20);
        await expect(contract.mint(arcAccount.address, 10)).to.be.revertedWith(
          'SyntheticTokenV2: minter limit reached',
        );
      });

      it('should not be able to mint over the limit', async () => {
        const contract = await getContract(arcAccount);
        await expect(contract.mint(arcAccount.address, 11)).to.be.revertedWith(
          'SyntheticTokenV2: minter limit reached',
        );
      });

      it('increases the totalSupply', async () => {
        let totalSupply = await syntheticToken.totalSupply();

        expect(totalSupply).to.eq(10);

        const minter = getContract(arcAccount);
        await minter.mint(userAccount.address, 10);

        totalSupply = await syntheticToken.totalSupply();

        expect(totalSupply).to.eq(20);
      });
    });

    describe('#addMinter', () => {
      it('should not be able to add a minter as an unauthorised user', async () => {
        const contract = await getContract(otherAccount);

        await expect(
          contract.addMinter(otherAccount.address, 100),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('should be able to add a minter as the owner', async () => {
        // Set up fresh minter with 100 limit
        await syntheticToken.removeMinter(arcAccount.address);
        await syntheticToken.addMinter(arcAccount.address, 100);

        let minters = await syntheticToken.getAllMinters();
        expect(minters.length).to.equal(1);
        expect(minters[0]).to.equal(arcAccount.address);
        expect(
          await syntheticToken.getMinterLimit(arcAccount.address),
        ).to.equal(100);

        await syntheticToken.addMinter(arcAccount1.address, 100);
        minters = await syntheticToken.getAllMinters();
        expect(minters.length).to.equal(2);
        expect(minters[0]).to.equal(arcAccount.address);
        expect(minters[1]).to.equal(arcAccount1.address);
        expect(
          await syntheticToken.getMinterLimit(arcAccount.address),
        ).to.equal(100);
        expect(
          await syntheticToken.getMinterLimit(arcAccount1.address),
        ).to.equal(100);

        await syntheticToken.addMinter(arcAccount2.address, 100);
        minters = await syntheticToken.getAllMinters();
        expect(minters.length).to.equal(3);
        expect(minters[0]).to.equal(arcAccount.address);
        expect(minters[1]).to.equal(arcAccount1.address);
        expect(minters[2]).to.equal(arcAccount2.address);
        expect(
          await syntheticToken.getMinterLimit(arcAccount.address),
        ).to.equal(100);
        expect(
          await syntheticToken.getMinterLimit(arcAccount1.address),
        ).to.equal(100);
        expect(
          await syntheticToken.getMinterLimit(arcAccount2.address),
        ).to.equal(100);

        await syntheticToken.removeMinter(arcAccount1.address);
        minters = await syntheticToken.getAllMinters();
        expect(minters.length).to.equal(2);
        expect(minters[0]).to.equal(arcAccount.address);
        expect(minters[1]).to.equal(arcAccount2.address);
        expect(await syntheticToken.isValidMinter(arcAccount1.address)).to.be
          .false;
        expect(
          await syntheticToken.getMinterLimit(arcAccount.address),
        ).to.equal(100);
        expect(
          await syntheticToken.getMinterLimit(arcAccount1.address),
        ).to.equal(0);
        expect(
          await syntheticToken.getMinterLimit(arcAccount2.address),
        ).to.equal(100);

        await syntheticToken.removeMinter(arcAccount.address);
        minters = await syntheticToken.getAllMinters();
        expect(minters.length).to.equal(1);
        expect(minters[0]).to.equal(arcAccount2.address);
        expect(await syntheticToken.isValidMinter(arcAccount.address)).to.be
          .false;
        expect(await syntheticToken.isValidMinter(arcAccount1.address)).to.be
          .false;
        expect(
          await syntheticToken.getMinterLimit(arcAccount.address),
        ).to.equal(0);
        expect(
          await syntheticToken.getMinterLimit(arcAccount1.address),
        ).to.equal(0);
        expect(
          await syntheticToken.getMinterLimit(arcAccount2.address),
        ).to.equal(100);
      });

      it('should not be able to add a minter as another minter', async () => {
        const arcContract = await getContract(arcAccount);
        await expect(
          arcContract.addMinter(otherAccount.address, 100),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('should not be able to re-add a minter as the owner', async () => {
        await expect(
          syntheticToken.addMinter(arcAccount.address, 100),
        ).to.be.revertedWith('SyntheticTokenV2: Minter already exists');
      });

      it('emits MinterAdded', async () => {
        await expect(syntheticToken.addMinter(arcAccount1.address, 100))
          .to.emit(syntheticToken, 'MinterAdded')
          .withArgs(arcAccount1.address, 100);
      });
    });

    describe('#removeMinter', () => {
      it('should not be able to remove a minter as an unauthorised user', async () => {
        const contract = await getContract(otherAccount);
        await expectRevert(contract.removeMinter(otherAccount.address));
      });

      it('should be able to remove a minter as the owner', async () => {
        const contract = await getContract(ownerAccount);
        await contract.removeMinter(arcAccount.address);

        expect(await (await contract.getAllMinters()).length).to.equal(0);
        expect(await contract.isValidMinter(arcAccount.address)).to.be.false;
      });

      it('should not be able to remove a minter as another minter', async () => {
        const arcContract = await getContract(arcAccount);
        await expectRevert(arcContract.removeMinter(otherAccount.address));
      });

      it('should not be able to remove a non-existent minter as the owner', async () => {
        const contract = await getContract(ownerAccount);
        await contract.removeMinter(arcAccount.address);
        await expectRevert(contract.removeMinter(arcAccount.address));
      });
    });

    describe('#updateMinterLimit', () => {
      it('should not be able to update the limit as an unauthorised user', async () => {
        const contract = await getContract(otherAccount);
        await expect(
          contract.updateMinterLimit(arcAccount.address, 200),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('should not be able to set the limit for an invalid minter', async () => {
        const contract = await getContract(ownerAccount);
        await expect(
          contract.updateMinterLimit(arcAccount1.address, 200),
        ).to.be.revertedWith('SyntheticTokenV2: minter does not exist');
      });

      it('should be able to update the limit as the owner', async () => {
        const contract = await getContract(ownerAccount);
        await contract.updateMinterLimit(arcAccount.address, 200);
        expect(await contract.getMinterLimit(arcAccount.address)).to.equal(200);
      });

      it('should be able to mint more if the limits increase', async () => {
        // Increase the limit up to 100
        const currentIssued = await syntheticToken.getMinterIssued(
          arcAccount.address,
        );
        await syntheticToken.updateMinterLimit(
          arcAccount.address,
          currentIssued.add(100),
        );

        const minterContract = await getContract(arcAccount);

        await minterContract.mint(otherAccount.address, 100);
        let issuance = await minterContract.getMinterIssued(arcAccount.address);
        expect(issuance).to.equal(currentIssued.add(100));

        await expect(
          minterContract.mint(otherAccount.address, 1),
        ).to.be.revertedWith('SyntheticTokenV2: minter limit reached');
        const ownerContract = await getContract(ownerAccount);

        await ownerContract.updateMinterLimit(
          arcAccount.address,
          currentIssued.add(200),
        );
        await minterContract.mint(otherAccount.address, 100);

        issuance = await minterContract.getMinterIssued(arcAccount.address);
        expect(
          await minterContract.getMinterLimit(arcAccount.address),
        ).to.equal(210);
        expect(issuance).to.equal(210);

        await expect(
          minterContract.mint(otherAccount.address, 1),
        ).to.be.revertedWith('SyntheticTokenV2: minter limit reached');
      });
    });

    describe('#destroy', () => {
      it('reverts if trying to destroy more tokens than minted', async () => {
        const userBalance = await syntheticToken.balanceOf(userAccount.address);
        expect(userBalance).to.eq(10);

        // Add second minter with limit of 5
        await syntheticToken.addMinter(arcAccount1.address, 5);

        // User transfers coins to the minter
        const userContract = getContract(userAccount);
        await userContract.transfer(arcAccount1.address, 10);

        expect(await syntheticToken.balanceOf(arcAccount1.address)).to.eq(10);

        const minter1 = getContract(arcAccount1);
        await expect(minter1.destroy(10)).to.be.revertedWith(
          'SyntheticTokenV2: cannot destroy more than minted',
        );
      });

      it(`destroys the given amount of caller's tokens`, async () => {
        const userBalance = await syntheticToken.balanceOf(userAccount.address);
        expect(userBalance).to.eq(10);

        // User transfers coins to the minter
        const userContract = getContract(userAccount);
        await userContract.transfer(arcAccount.address, 10);

        expect(await syntheticToken.balanceOf(arcAccount.address)).to.eq(10);

        const minter = getContract(arcAccount);
        await minter.destroy('10');

        expect(await syntheticToken.balanceOf(arcAccount.address)).to.eq(0);
        expect(await syntheticToken.balanceOf(userAccount.address)).to.eq(0);
      });
    });

    describe('#approve', () => {
      it('reverts if approving to zero address', async () => {
        const userContract = getContract(userAccount);

        await expect(
          userContract.approve(constants.AddressZero, 21),
        ).to.be.revertedWith('SyntheticTokenV2: approve to the zero address');
      });

      it('approves spender and increases allowance', async () => {
        const userContract = getContract(userAccount);

        await userContract.approve(arcAccount.address, 21),
          expect(
            await userContract.allowance(
              userAccount.address,
              arcAccount.address,
            ),
          ).to.eq(21);
      });
    });

    describe('#transfer', () => {
      it('reverts if caller does not have enough tokens', async () => {
        const userContract = getContract(userAccount);
        await expect(
          userContract.transfer(arcAccount.address, 11),
        ).to.be.revertedWith(
          'SyntheticTokenV2: sender does not have enough balance',
        );
      });

      it('transfers the tokens to the recepient', async () => {
        const userBalance = await syntheticToken.balanceOf(userAccount.address);
        expect(userBalance).to.eq(10);

        const userContract = getContract(userAccount);
        await userContract.transfer(arcAccount1.address, 10);

        expect(await syntheticToken.balanceOf(userAccount.address)).to.eq(0);
        expect(await syntheticToken.balanceOf(arcAccount1.address)).to.eq(10);
      });
    });

    describe('#transferFrom', () => {
      it('reverts if sender did not approve the caller', async () => {
        const minter = getContract(arcAccount);

        await expect(
          minter.transferFrom(userAccount.address, arcAccount.address, 10),
        ).to.be.revertedWith(
          'SyntheticTokenv2: the amount has not been approved for this spender',
        );
      });

      it('transfers the tokens from the sender to the recipient', async () => {
        const userContract = getContract(userAccount);
        const minter = getContract(arcAccount);

        await userContract.approve(arcAccount.address, 5);

        await expect(
          minter.transferFrom(userAccount.address, arcAccount.address, 6),
        ).to.be.revertedWith(
          'SyntheticTokenv2: the amount has not been approved for this spender',
        );

        expect(await syntheticToken.balanceOf(arcAccount.address)).to.eq(0);

        await minter.transferFrom(userAccount.address, arcAccount.address, 5),
          expect(await syntheticToken.balanceOf(arcAccount.address)).to.eq(5);
        expect(await syntheticToken.balanceOf(arcAccount.address)).to.eq(5);
      });
    });

    describe('#permit', () => {
      let signature: any;

      before(async () => {
        const nonce = await syntheticToken.permitNonces(ownerAccount.address);
        const tokenVersion = await syntheticToken.version();

        signature = await signPermit(
          userAccount,
          hre.network.config.chainId,
          syntheticToken.address,
          tokenVersion,
          arcAccount.address,
          Date.now() + 1000,
          nonce.toNumber(),
        );
      });

      it.only('reverts if the signature is wrong', async () => {
        console.log({ signature });
      });

      it('reverts if the signature is expired');

      it('permits and increases allowance');
    });

    describe('integration', () => {
      it('successfully calls transferFrom() after calling permit()');
    });
  });
});
