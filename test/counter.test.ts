import chai from "chai";

import { ethers } from "@nomiclabs/buidler";
import { Signer, Wallet } from "ethers";
import { solidity } from "ethereum-waffle";

chai.use(solidity);

const { expect } = chai;

// describe("Class", () => {
//   let signers: Signer[];

//   beforeEach(async () => {
//     signers = await ethers.signers();
//   });
// });
