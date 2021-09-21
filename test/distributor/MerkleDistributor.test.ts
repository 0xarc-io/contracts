import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber, constants } from 'ethers';

import BalanceTree from '@src/MerkleTree/BalanceTree';
import { generateContext, ITestContext } from '@test/contracts/context';
import { distributorFixture } from '@test/contracts/fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { MerkleDistributor } from '@src/typings/MerkleDistributor';
import { MerkleDistributor__factory } from '@src/typings';

chai.use(solidity);

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

describe('MerkleDistributor', () => {
  let ctx: ITestContext;
  let distributor: MerkleDistributor;

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    ctx = await generateContext(distributorFixture, async () => {});
    distributor = await new MerkleDistributor__factory(
      ctx.signers.admin,
    ).deploy(ctx.contracts.collateral.address, ZERO_BYTES32);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#token', () => {
    it('returns the ctx.contracts.collateral address', async () => {
      expect(await distributor.token()).to.eq(ctx.contracts.collateral.address);
    });
  });

  describe('#merkleRoot', () => {
    it('returns the zero merkle root', async () => {
      expect(await distributor.merkleRoot()).to.eq(ZERO_BYTES32);
    });
  });

  describe('#switchActive', () => {
    it('owner can switch activity', async () => {
      expect(await distributor.merkleRoot()).to.eq(ZERO_BYTES32);
      expect(await distributor.active()).to.be.false;
      await distributor.switchActive();
      expect(await distributor.active()).to.be.true;
    });

    it('fails if non-owner try to switch activity', async () => {
      expect(await distributor.merkleRoot()).to.eq(ZERO_BYTES32);
      expect(await distributor.active()).to.be.false;
      await expect(
        distributor.connect(ctx.signers.unauthorized).switchActive(),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('#claim', () => {
    it('fails for empty proof', async () => {
      await distributor.switchActive();
      await expect(
        distributor.claim(0, ctx.signers.admin.address, 10, []),
      ).to.be.revertedWith('MerkleDistributor: Invalid proof');
    });

    it('fails for invalid index', async () => {
      await distributor.switchActive();
      await expect(
        distributor.claim(0, ctx.signers.admin.address, 10, []),
      ).to.be.revertedWith('MerkleDistributor: Invalid proof');
    });

    it('fails for not active contract', async () => {
      await expect(
        distributor.claim(0, ctx.signers.admin.address, 10, []),
      ).to.be.revertedWith('MerkleDistributor: Contract is not active');
    });

    describe('two account tree', () => {
      let distributor: MerkleDistributor;
      let tree: BalanceTree;
      beforeEach('deploy', async () => {
        tree = new BalanceTree([
          { account: ctx.signers.admin.address, amount: BigNumber.from(100) },
          {
            account: ctx.signers.unauthorized.address,
            amount: BigNumber.from(101),
          },
        ]);
        distributor = await new MerkleDistributor__factory(
          ctx.signers.admin,
        ).deploy(ctx.contracts.collateral.address, tree.getHexRoot());
        await distributor.switchActive();
        await ctx.contracts.collateral.mintShare(distributor.address, 201);
      });

      it('successful claim', async () => {
        const proof0 = tree.getProof(
          0,
          ctx.signers.admin.address,
          BigNumber.from(100),
        );
        await expect(
          distributor.claim(0, ctx.signers.admin.address, 100, proof0),
        )
          .to.emit(distributor, 'Claimed')
          .withArgs(0, ctx.signers.admin.address, 100);
        const proof1 = tree.getProof(
          1,
          ctx.signers.unauthorized.address,
          BigNumber.from(101),
        );
        await expect(
          distributor.claim(1, ctx.signers.unauthorized.address, 101, proof1),
        )
          .to.emit(distributor, 'Claimed')
          .withArgs(1, ctx.signers.unauthorized.address, 101);
      });

      it('transfers the ctx.contracts.collateral', async () => {
        const proof0 = tree.getProof(
          0,
          ctx.signers.admin.address,
          BigNumber.from(100),
        );
        expect(
          await ctx.contracts.collateral.balanceOf(ctx.signers.admin.address),
        ).to.eq(0);
        await distributor.claim(0, ctx.signers.admin.address, 100, proof0);
        expect(
          await ctx.contracts.collateral.balanceOf(ctx.signers.admin.address),
        ).to.eq(100);
      });

      it('must have enough to transfer', async () => {
        const proof0 = tree.getProof(
          0,
          ctx.signers.admin.address,
          BigNumber.from(100),
        );
        await ctx.contracts.collateral.redeemShare(distributor.address, 140);
        await expect(
          distributor.claim(0, ctx.signers.admin.address, 100, proof0),
        ).to.be.revertedWith('SafeMath: subtraction overflow');
      });

      it('sets #isClaimed', async () => {
        const proof0 = tree.getProof(
          0,
          ctx.signers.admin.address,
          BigNumber.from(100),
        );
        expect(await distributor.isClaimed(0)).to.eq(false);
        expect(await distributor.isClaimed(1)).to.eq(false);
        await distributor.claim(0, ctx.signers.admin.address, 100, proof0);
        expect(await distributor.isClaimed(0)).to.eq(true);
        expect(await distributor.isClaimed(1)).to.eq(false);
      });

      it('cannot allow two claims', async () => {
        const proof0 = tree.getProof(
          0,
          ctx.signers.admin.address,
          BigNumber.from(100),
        );
        await distributor.claim(0, ctx.signers.admin.address, 100, proof0);
        await expect(
          distributor.claim(0, ctx.signers.admin.address, 100, proof0),
        ).to.be.revertedWith('MerkleDistributor: Drop already claimed');
      });

      it('cannot claim more than once: 0 and then 1', async () => {
        await distributor.claim(
          0,
          ctx.signers.admin.address,
          100,
          tree.getProof(0, ctx.signers.admin.address, BigNumber.from(100)),
        );
        await distributor.claim(
          1,
          ctx.signers.unauthorized.address,
          101,
          tree.getProof(
            1,
            ctx.signers.unauthorized.address,
            BigNumber.from(101),
          ),
        );

        await expect(
          distributor.claim(
            0,
            ctx.signers.admin.address,
            100,
            tree.getProof(0, ctx.signers.admin.address, BigNumber.from(100)),
          ),
        ).to.be.revertedWith('MerkleDistributor: Drop already claimed');
      });

      it('cannot claim more than once: 1 and then 0', async () => {
        await distributor.claim(
          1,
          ctx.signers.unauthorized.address,
          101,
          tree.getProof(
            1,
            ctx.signers.unauthorized.address,
            BigNumber.from(101),
          ),
        );
        await distributor.claim(
          0,
          ctx.signers.admin.address,
          100,
          tree.getProof(0, ctx.signers.admin.address, BigNumber.from(100)),
        );

        await expect(
          distributor.claim(
            1,
            ctx.signers.unauthorized.address,
            101,
            tree.getProof(
              1,
              ctx.signers.unauthorized.address,
              BigNumber.from(101),
            ),
          ),
        ).to.be.revertedWith('MerkleDistributor: Drop already claimed');
      });

      it('cannot claim for address other than proof', async () => {
        const proof0 = tree.getProof(
          0,
          ctx.signers.admin.address,
          BigNumber.from(100),
        );
        await expect(
          distributor.claim(1, ctx.signers.unauthorized.address, 101, proof0),
        ).to.be.revertedWith('MerkleDistributor: Invalid proof');
      });

      it('cannot claim more than proof', async () => {
        const proof0 = tree.getProof(
          0,
          ctx.signers.admin.address,
          BigNumber.from(100),
        );
        await expect(
          distributor.claim(0, ctx.signers.admin.address, 101, proof0),
        ).to.be.revertedWith('MerkleDistributor: Invalid proof');
      });
    });

    describe('larger tree', () => {
      let tree: BalanceTree;
      beforeEach('deploy', async () => {
        tree = new BalanceTree(
          Object.keys(ctx.signers).map((signerKey, ix) => {
            return {
              account: ctx.signers[signerKey].address,
              amount: BigNumber.from(ix + 1),
            };
          }),
        );
        distributor = await new MerkleDistributor__factory(
          ctx.signers.admin,
        ).deploy(ctx.contracts.collateral.address, tree.getHexRoot());
        await distributor.switchActive();
        await ctx.contracts.collateral.mintShare(distributor.address, 201);
      });

      it('claim index 4', async () => {
        const proof = tree.getProof(
          4,
          ctx.signers.staker.address,
          BigNumber.from(5),
        );
        await expect(distributor.claim(4, ctx.signers.staker.address, 5, proof))
          .to.emit(distributor, 'Claimed')
          .withArgs(4, ctx.signers.staker.address, 5);
      });

      it('claim index 8', async () => {
        const proof = tree.getProof(
          8,
          ctx.signers.unauthorized.address,
          BigNumber.from(9),
        );
        await expect(
          distributor.claim(8, ctx.signers.unauthorized.address, 9, proof),
        )
          .to.emit(distributor, 'Claimed')
          .withArgs(8, ctx.signers.unauthorized.address, 9);
      });
    });

    describe('realistic size tree', () => {
      let distributor: MerkleDistributor;
      let tree: BalanceTree;
      const NUM_LEAVES = 100_000;
      const NUM_SAMPLES = 25;
      const elements: { account: string; amount: BigNumber }[] = [];

      before(() => {
        for (let i = 0; i < NUM_LEAVES; i++) {
          const node = {
            account: ctx.signers.admin.address,
            amount: BigNumber.from(100),
          };
          elements.push(node);
        }
        tree = new BalanceTree(elements);
      });

      it('proof verification works', () => {
        const root = tree.getHexRoot();
        for (let i = 0; i < NUM_LEAVES; i += NUM_LEAVES / NUM_SAMPLES) {
          const proof = tree.getProof(
            i,
            ctx.signers.admin.address,
            BigNumber.from(100),
          );
          const validProof = BalanceTree.verifyProof(
            i,
            ctx.signers.admin.address,
            BigNumber.from(100),
            proof,
            root,
          );
          expect(validProof).to.be.true;
        }
      });

      beforeEach('deploy', async () => {
        distributor = await new MerkleDistributor__factory(
          ctx.signers.admin,
        ).deploy(ctx.contracts.collateral.address, tree.getHexRoot());
        await distributor.switchActive();
        await ctx.contracts.collateral.mintShare(
          distributor.address,
          constants.MaxUint256,
        );
      });

      it('no double claims in random distribution', async () => {
        for (
          let i = 0;
          i < 25;
          i += Math.floor(Math.random() * (NUM_LEAVES / NUM_SAMPLES))
        ) {
          const proof = tree.getProof(
            i,
            ctx.signers.admin.address,
            BigNumber.from(100),
          );
          await distributor.claim(i, ctx.signers.admin.address, 100, proof);
          await expect(
            distributor.claim(i, ctx.signers.admin.address, 100, proof),
          ).to.be.revertedWith('MerkleDistributor: Drop already claimed');
        }
      });
    });
  });
});
