// From https://github.com/makerdao/developerguides/blob/master/dai/how-to-use-permit-function/how-to-use-permit-function.md
// and https://docs.ethers.io/v5/api/signer/

import { defaultAbiCoder } from '@ethersproject/abi';
import { _TypedDataEncoder } from '@ethersproject/hash';
import { keccak256 } from '@ethersproject/keccak256';
import { toUtf8Bytes } from '@ethersproject/strings';
import { verifyTypedData } from '@ethersproject/wallet';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BaseERC20Factory } from '@src/typings';
import { BigNumber, BytesLike, Contract, utils, Wallet } from 'ethers';
import { solidityPack, hexlify } from 'ethers/lib/utils';
import { ecsign } from 'ethereumjs-util';

export interface SignatureResult {
  v: number;
  r: string;
  s: string;
}

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes(
    'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)',
  ),
);

// from https://github.com/Uniswap/uniswap-v2-core/blob/4dd59067c76dea4a0e8e4bfdda41877a6b16dedc/test/shared/utilities.ts#L21
function getDomainSeparator(name: string, tokenAddress: string) {
  return keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        keccak256(
          toUtf8Bytes(
            'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
          ),
        ),
        keccak256(toUtf8Bytes(name)),
        keccak256(toUtf8Bytes('1')),
        1,
        tokenAddress,
      ],
    ),
  );
}

async function getApprovalDigest(
  token: Contract,
  approve: {
    owner: string;
    spender: string;
    value: BigNumber;
  },
  nonce: BigNumber,
  deadline: BigNumber,
): Promise<string> {
  const name = await token.name();
  const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address);
  return keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [
              PERMIT_TYPEHASH,
              approve.owner,
              approve.spender,
              approve.value,
              nonce,
              deadline,
            ],
          ),
        ),
      ],
    ),
  );
}

// const createPermitMessageData = async (
//   signer: Wallet,
//   chainId: BigNumber,
//   tokenAddress: string,
//   tokenVersion: string,
//   spender: string,
//   permitAmount: BigNumber,
//   expiry: BigNumber,
//   nonce: BigNumber,
// ) => {
//   const tokenContract = BaseERC20Factory.connect(tokenAddress, signer);

//   const domain = {
//     name: await tokenContract.name(),
//     version: tokenVersion,
//     chainId: chainId.toNumber(),
//     verifyingContract: tokenAddress,
//   };

//   const types = {
//     EIP712Domain: [
//       {
//         name: 'name',
//         type: 'string',
//       },
//       {
//         name: 'version',
//         type: 'string',
//       },
//       {
//         name: 'chainId',
//         type: 'uint256',
//       },
//       {
//         name: 'verifyingContract',
//         type: 'address',
//       },
//     ],
//     Permit: [
//       {
//         name: 'owner',
//         type: 'address',
//       },
//       {
//         name: 'spender',
//         type: 'address',
//       },
//       {
//         name: 'value',
//         type: 'uint256',
//       },
//       {
//         name: 'nonce',
//         type: 'uint256',
//       },
//       {
//         name: 'deadline',
//         type: 'uint256',
//       },
//     ],
//   };

//   const value = {
//     owner: signer.address,
//     spender: spender,
//     value: permitAmount.toString(),
//     nonce: nonce.toNumber(),
//     deadline: expiry.toNumber(),
//   };

//   return {
//     domain,
//     types,
//     value,
//   };
// };

// const signData = async (signer: Wallet, permitMessageData) => {
//   try {
//     const res = await signer._signTypedData(
//       permitMessageData.domain,
//       permitMessageData.types,
//       permitMessageData.value,
//     );

//     return {
//       r: res.slice(0, 66),
//       s: '0x' + res.slice(66, 130),
//       v: Number('0x' + res.slice(130, 132)),
//     };
//   } catch (e) {
//     console.error(e);
//   }

//   return {
//     v: null,
//     r: null,
//     s: null,
//   };
// };

export async function signPermit(
  owner: Wallet,
  token: Contract,
  spender: string,
  permitAmount: BigNumber,
  deadline: BigNumber,
  nonce: BigNumber,
): Promise<SignatureResult> {
  // const messageData = await createPermitMessageData(
  //   owner,
  //   chainId,
  //   tokenAddress,
  //   tokenVersion,
  //   spender,
  //   permitAmount,
  //   deadline,
  //   nonce,
  // );

  // const sig = await signData(owner, messageData);

  // console.log(
  //   'verified:',
  //   verifyTypedData(
  //     messageData.domain,
  //     messageData.types,
  //     messageData.value,
  //     sig,
  //   ),
  // );

  const digest = await getApprovalDigest(
    token,
    {
      owner: owner.address,
      spender,
      value: permitAmount,
    },
    nonce,
    deadline,
  );

  const { v, r, s } = ecsign(
    Buffer.from(digest.slice(2), 'hex'),
    Buffer.from(owner.privateKey.slice(2), 'hex'),
  );

  return {
    v,
    r: hexlify(r),
    s: hexlify(s),
  };
}
