import 'module-alias/register';
import { expect } from 'chai';
import { deployArcProxy, deployCredsERC20 } from '../deployers';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expectRevert } from '../../helpers/expectRevert';
import { CredsERC20 } from '@src/typings/CredsERC20';
import { constants, Wallet } from 'ethers';
import { CredsERC20Factory } from '@src/typings/CredsERC20Factory';
import { ARITHMETIC_ERROR } from '@test/helpers/contractErrors';

describe('CredsERC20', () => {
  let creds: CredsERC20;

  let ownerAccount: SignerWithAddress;
  let arcAccount: SignerWithAddress;
  let arcAccount1: SignerWithAddress;
  let arcAccount2: SignerWithAddress;
  let otherAccount: SignerWithAddress;
  let userAccount: SignerWithAddress;

  function getContract(caller: SignerWithAddress | Wallet) {
    return CredsERC20Factory.connect(creds.address, caller);
  }

  before(async () => {
    const signers = await ethers.getSigners();
    arcAccount = signers[0];
    ownerAccount = signers[1];
    otherAccount = signers[2];
    arcAccount1 = signers[3];
    arcAccount2 = signers[4];
    userAccount = signers[5];

    creds = await deployCredsERC20(ownerAccount, 'Creds', 'CR');
    await creds.addMinter(arcAccount.address, 20);

    // Add arc account as minter
    await creds.connect(arcAccount).mint(userAccount.address, 10);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('view functions', () => {
    describe('#decimals', () => {
      it('returns 18 decimals', async () => {
        expect(await creds.decimals()).to.eq(18);
      });
    });

    describe('#getAllMinters', () => {
      it('returns all minters', async () => {
        let minters = await creds.getAllMinters();
        expect(minters).to.have.length(1);
        expect(minters[0]).to.eq(arcAccount.address);

        await creds.addMinter(arcAccount1.address, 21);

        minters = await creds.getAllMinters();

        expect(minters).to.have.length(2);
        expect(minters[1]).to.eq(arcAccount1.address);
      });
    });

    describe('#isValidMinter', () => {
      it('returns true if minter is valid', async () => {
        expect(await creds.isValidMinter(arcAccount.address)).to.be.true;
        expect(await creds.isValidMinter(arcAccount1.address)).to.be.false;

        await creds.addMinter(arcAccount1.address, 21);

        expect(await creds.isValidMinter(arcAccount.address)).to.be.true;
        expect(await creds.isValidMinter(arcAccount1.address)).to.be.true;
      });
    });

    describe('#getMinterIssued', () => {
      it('returns the amount of synth issued for the given minter', async () => {
        let amtIssued = await creds.minterIssued(arcAccount.address);

        expect(amtIssued).to.eq(10);

        await creds.addMinter(arcAccount1.address, 15);

        const minterContract = getContract(arcAccount1);
        await minterContract.mint(userAccount.address, 12);

        amtIssued = await creds.minterIssued(arcAccount1.address);
        expect(amtIssued).to.eq(12);
      });
    });
  });

  describe('mutative functions', () => {
    describe('#init', () => {
      it('reverts if called twice', async () => {
        await expect(creds.init('abc', 'abc')).to.be.revertedWith(
          'Initializable: contract is already initialized',
        );
      });

      it('initializes token with name, symbol and version', async () => {
        // the synth had already been initialized in the before function
        const name = await creds.name();
        const symbol = await creds.symbol();
        const version = await creds.version();
        const domainSeparator = await creds.DOMAIN_SEPARATOR();

        expect(name).to.eq('Creds');
        expect(symbol).to.eq('CR');
        expect(version).to.eq('1');
        expect(domainSeparator).to.not.be.empty;
      });

      it('emits Initialized', async () => {
        const impl = await new CredsERC20Factory(ownerAccount).deploy();
        const proxy = await deployArcProxy(
          ownerAccount,
          impl.address,
          ownerAccount.address,
          [],
        );

        const _creds = CredsERC20Factory.connect(proxy.address, ownerAccount);

        await expect(_creds.init('Creds', 'CR'))
          .to.emit(_creds, 'Initialized')
          .withArgs('Creds', 'CR');
      });
    });

    describe('#mint', () => {
      before(async () => {
        const currentLimit = await creds.minterLimits(arcAccount.address);
        const issued = await creds.minterIssued(arcAccount.address);
        expect(currentLimit.sub(issued)).to.equal(10);
      });

      it('should not be able to mint as an unauthorised user', async () => {
        const contract = await getContract(userAccount);

        await expect(contract.mint(userAccount.address, 10)).to.be.revertedWith(
          'CredsERC20: only callable by minter',
        );
      });

      it('should be able to mint as arc', async () => {
        const contract = await getContract(arcAccount);
        await contract.mint(arcAccount.address, 9);
        expect(
          await (await creds.balanceOf(arcAccount.address)).toNumber(),
        ).to.equal(9);
      });

      it('mints to the limit', async () => {
        const contract = await getContract(arcAccount);
        await contract.mint(arcAccount.address, 10);

        expect(
          await (await creds.balanceOf(arcAccount.address)).toNumber(),
        ).to.equal(10);

        const issuance = await creds.minterIssued(arcAccount.address);
        expect(issuance).to.equal(20);
        await expect(contract.mint(arcAccount.address, 10)).to.be.revertedWith(
          'CredsERC20: minter limit reached',
        );
      });

      it('should not be able to mint over the limit', async () => {
        const contract = await getContract(arcAccount);
        await expect(contract.mint(arcAccount.address, 11)).to.be.revertedWith(
          'CredsERC20: minter limit reached',
        );
      });

      it('increases the totalSupply', async () => {
        let totalSupply = await creds.totalSupply();

        expect(totalSupply).to.eq(10);

        const minter = getContract(arcAccount);
        await minter.mint(userAccount.address, 10);

        totalSupply = await creds.totalSupply();

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
        await creds.removeMinter(arcAccount.address);
        await creds.addMinter(arcAccount.address, 100);

        let minters = await creds.getAllMinters();
        expect(minters.length).to.equal(1);
        expect(minters[0]).to.equal(arcAccount.address);
        expect(await creds.minterLimits(arcAccount.address)).to.equal(100);

        await creds.addMinter(arcAccount1.address, 100);
        minters = await creds.getAllMinters();
        expect(minters.length).to.equal(2);
        expect(minters[0]).to.equal(arcAccount.address);
        expect(minters[1]).to.equal(arcAccount1.address);
        expect(await creds.minterLimits(arcAccount.address)).to.equal(100);
        expect(await creds.minterLimits(arcAccount1.address)).to.equal(100);

        await creds.addMinter(arcAccount2.address, 100);
        minters = await creds.getAllMinters();
        expect(minters.length).to.equal(3);
        expect(minters[0]).to.equal(arcAccount.address);
        expect(minters[1]).to.equal(arcAccount1.address);
        expect(minters[2]).to.equal(arcAccount2.address);
        expect(await creds.minterLimits(arcAccount.address)).to.equal(100);
        expect(await creds.minterLimits(arcAccount1.address)).to.equal(100);
        expect(await creds.minterLimits(arcAccount2.address)).to.equal(100);

        await creds.removeMinter(arcAccount1.address);
        minters = await creds.getAllMinters();
        expect(minters.length).to.equal(2);
        expect(minters[0]).to.equal(arcAccount.address);
        expect(minters[1]).to.equal(arcAccount2.address);
        expect(await creds.isValidMinter(arcAccount1.address)).to.be.false;
        expect(await creds.minterLimits(arcAccount.address)).to.equal(100);
        expect(await creds.minterLimits(arcAccount1.address)).to.equal(0);
        expect(await creds.minterLimits(arcAccount2.address)).to.equal(100);

        await creds.removeMinter(arcAccount.address);
        minters = await creds.getAllMinters();
        expect(minters.length).to.equal(1);
        expect(minters[0]).to.equal(arcAccount2.address);
        expect(await creds.isValidMinter(arcAccount.address)).to.be.false;
        expect(await creds.isValidMinter(arcAccount1.address)).to.be.false;
        expect(await creds.minterLimits(arcAccount.address)).to.equal(0);
        expect(await creds.minterLimits(arcAccount1.address)).to.equal(0);
        expect(await creds.minterLimits(arcAccount2.address)).to.equal(100);
      });

      it('should not be able to add a minter as another minter', async () => {
        const arcContract = await getContract(arcAccount);
        await expect(
          arcContract.addMinter(otherAccount.address, 100),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('should not be able to re-add a minter as the owner', async () => {
        await expect(
          creds.addMinter(arcAccount.address, 100),
        ).to.be.revertedWith('CredsERC20: Minter already exists');
      });

      it('emits MinterAdded', async () => {
        await expect(creds.addMinter(arcAccount1.address, 100))
          .to.emit(creds, 'MinterAdded')
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
        ).to.be.revertedWith('CredsERC20: not a minter');
      });

      it('should be able to update the limit as the owner', async () => {
        const contract = await getContract(ownerAccount);
        await contract.updateMinterLimit(arcAccount.address, 200);
        expect(await contract.minterLimits(arcAccount.address)).to.equal(200);
      });

      it('should be able to mint more if the limits increase', async () => {
        // Increase the limit up to 100
        const currentIssued = await creds.minterIssued(arcAccount.address);
        await creds.updateMinterLimit(
          arcAccount.address,
          currentIssued.add(100),
        );

        const minterContract = await getContract(arcAccount);

        await minterContract.mint(otherAccount.address, 100);
        let issuance = await minterContract.minterIssued(arcAccount.address);
        expect(issuance).to.equal(currentIssued.add(100));

        await expect(
          minterContract.mint(otherAccount.address, 1),
        ).to.be.revertedWith('CredsERC20: minter limit reached');
        const ownerContract = await getContract(ownerAccount);

        await ownerContract.updateMinterLimit(
          arcAccount.address,
          currentIssued.add(200),
        );
        await minterContract.mint(otherAccount.address, 100);

        issuance = await minterContract.minterIssued(arcAccount.address);
        expect(await minterContract.minterLimits(arcAccount.address)).to.equal(
          210,
        );
        expect(issuance).to.equal(210);

        await expect(
          minterContract.mint(otherAccount.address, 1),
        ).to.be.revertedWith('CredsERC20: minter limit reached');
      });
    });

    describe('#burn', () => {
      it('reverts if trying to burn more tokens than the balance', async () => {
        expect(await creds.balanceOf(userAccount.address)).to.eq(10);

        const userContract = getContract(userAccount);
        await expect(userContract.burn(11)).to.be.revertedWith(
          ARITHMETIC_ERROR,
        );
      });

      it(`burns the caller's tokens`, async () => {
        expect(await creds.balanceOf(userAccount.address)).to.eq(10);

        const userContract = getContract(userAccount);
        await userContract.burn(10);

        expect(await creds.balanceOf(userAccount.address)).to.eq(0);
      });
    });

    describe('#approve', () => {
      it('reverts if approving to zero address', async () => {
        const userContract = getContract(userAccount);

        await expect(
          userContract.approve(constants.AddressZero, 21),
        ).to.be.revertedWith('ERC20: approve to the zero address');
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
        ).to.be.revertedWith(ARITHMETIC_ERROR);
      });

      it('transfers the tokens to the recepient', async () => {
        const userBalance = await creds.balanceOf(userAccount.address);
        expect(userBalance).to.eq(10);

        const userContract = getContract(userAccount);
        await userContract.transfer(arcAccount1.address, 10);

        expect(await creds.balanceOf(userAccount.address)).to.eq(0);
        expect(await creds.balanceOf(arcAccount1.address)).to.eq(10);
      });
    });

    describe('#transferFrom', () => {
      it('reverts if sender did not approve the caller', async () => {
        const minter = getContract(arcAccount);

        await expect(
          minter.transferFrom(userAccount.address, arcAccount.address, 10),
        ).to.be.revertedWith(ARITHMETIC_ERROR);
      });

      it('transfers the tokens from the sender to the recipient', async () => {
        const userContract = getContract(userAccount);
        const minter = getContract(arcAccount);

        await userContract.approve(arcAccount.address, 5);

        await expect(
          minter.transferFrom(userAccount.address, arcAccount.address, 6),
        ).to.be.revertedWith(ARITHMETIC_ERROR);

        expect(await creds.balanceOf(arcAccount.address)).to.eq(0);

        await minter.transferFrom(userAccount.address, arcAccount.address, 5),
          expect(await creds.balanceOf(arcAccount.address)).to.eq(5);
        expect(await creds.balanceOf(arcAccount.address)).to.eq(5);
      });
    });
  });
});
