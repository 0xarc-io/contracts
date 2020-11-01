// import 'module-alias/register';

// import ArcNumber from '@src/utils/ArcNumber';
// import ArcDecimal from '@src/utils/ArcDecimal';
// import { Account, getWaffleExpect } from '../../helpers/testingUtils';
// import d2ArcDescribe, { initializeD2Arc } from '@test/helpers/d2ArcDescribe';
// import { ITestContext } from '@test/helpers/d2ArcDescribe';
// import { D2ArcOptions } from '../../helpers/d2ArcDescribe';
// import { ADMINABLE_ERROR } from '../../helpers/contractErrors';
// import { BigNumber } from 'ethers/utils';

// let ownerAccount: Account;
// let minterAccount: Account;
// let otherAccount: Account;

// async function init(ctx: ITestContext): Promise<void> {
//   [ownerAccount, otherAccount] = ctx.accounts;
// }

// const expect = getWaffleExpect();

// d2ArcDescribe('D2Core.setters()', init, (ctx: ITestContext) => {
//   before(async () => {});

//   describe('#init', () => {
//     it('should not be settable by any user', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), otherAccount.wallet);
//       await expect(
//         contract.init(ownerAccount.address, ownerAccount.address, ownerAccount.address),
//       ).to.be.revertedWith(ADMINABLE_ERROR);
//     });

//     it('should only be settable by the admin', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), ownerAccount.wallet);
//       await contract.init(ownerAccount.address, ownerAccount.address, ownerAccount.address);
//       expect(await contract.getCollateralAsset()).to.equal(ownerAccount.address);
//       expect(await contract.getSyntheticAsset()).to.equal(ownerAccount.address);
//       expect(await contract.getCurrentOracle()).to.equal(ownerAccount.address);
//     });
//   });

//   describe('#setRate', () => {
//     it('should not be settable by any user', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), otherAccount.wallet);
//       await expect(contract.setRate(999)).to.be.revertedWith(ADMINABLE_ERROR);
//     });

//     it('should only be settable by the admin', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), ownerAccount.wallet);
//       await contract.setRate(999);
//       expect(await contract.getInterestRate()).to.equal(new BigNumber(999));
//     });
//   });

//   describe('#setOracle', () => {
//     it('should not be settable by any user', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), otherAccount.wallet);
//       await expect(contract.setOracle(ownerAccount.address)).to.be.revertedWith(ADMINABLE_ERROR);
//     });

//     it('should only be settable by the admin', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), ownerAccount.wallet);
//       await contract.setOracle(ownerAccount.address);
//       expect(await contract.getCurrentOracle()).to.equal(ownerAccount.address);
//     });
//   });

//   describe('#setCollateralRatio', () => {
//     it('should not be settable by any user', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), otherAccount.wallet);
//       await expect(contract.setCollateralRatio(ArcDecimal.new(5))).to.be.revertedWith(
//         ADMINABLE_ERROR,
//       );
//     });

//     it('should only be settable by the admin', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), ownerAccount.wallet);
//       await contract.setCollateralRatio(ArcDecimal.new(5));
//       expect(await (await contract.getCollateralRatio()).value).to.equal(ArcDecimal.new(5).value);
//     });
//   });

//   describe('#setPrinterDestination', () => {
//     it('should not be settable by any user', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), otherAccount.wallet);
//       await expect(contract.setPrinterDestination(ownerAccount.address)).to.be.revertedWith(
//         ADMINABLE_ERROR,
//       );
//     });

//     it('should only be settable by the admin', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), ownerAccount.wallet);
//       await contract.setPrinterDestination(ownerAccount.address);
//       expect(await contract.printerDestination()).to.equal(ownerAccount.address);
//     });
//   });

//   describe('#setFees', () => {
//     it('should not be settable by any user', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), otherAccount.wallet);
//       await expect(
//         contract.setFees(ArcDecimal.new(5), ArcDecimal.new(5), ArcDecimal.new(5)),
//       ).to.be.revertedWith(ADMINABLE_ERROR);
//     });

//     it('should only be settable by the admin', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), ownerAccount.wallet);
//       await contract.setFees(ArcDecimal.new(5), ArcDecimal.new(0.5), ArcDecimal.new(0.1));
//       expect(await contract.liquidationUserFee()).to.equal(ArcDecimal.new(5).value);
//       expect(await contract.liquidationArcRatio()).to.equal(ArcDecimal.new(0.5).value);
//       expect(await contract.printerArcRatio()).to.equal(ArcDecimal.new(0.1).value);
//     });
//   });

//   describe('#setLimits', () => {
//     it('should not be settable by any user', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), otherAccount.wallet);
//       await expect(contract.setLimits(1, 2, 3)).to.be.revertedWith(ADMINABLE_ERROR);
//     });

//     it('should only be settable by the admin', async () => {
//       const contract = await ctx.arc.getCore(ctx.arc.synth(), ownerAccount.wallet);
//       await contract.setLimits(1, 2, 3);
//       expect((await contract.getLimits())[0]).to.equal(new BigNumber(1));
//       expect((await contract.getLimits())[1]).to.equal(new BigNumber(2));
//       expect((await contract.getLimits())[2]).to.equal(new BigNumber(3));
//     });
//   });
// });
