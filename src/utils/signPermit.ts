// From https://github.com/makerdao/developerguides/blob/master/dai/how-to-use-permit-function/how-to-use-permit-function.md
// and https://docs.ethers.io/v5/api/signer/

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BaseERC20__factory } from '@src/typings';
import { BigNumberish, BytesLike, providers, VoidSigner } from 'ethers';

interface TypedDataDomain {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
  salt?: BytesLike;
}

interface TypedDataField {
  name: string;
  type: string;
}

interface IPermitMessageData {
  domain: TypedDataDomain;
  types: Record<string, Array<TypedDataField>>;
  value: Record<string, any>;
}

const createPermitMessageData = async (
  signer: SignerWithAddress,
  chainId: number,
  tokenAddress: string,
  tokenVersion: string,
  spender: string,
  expiry: number,
  nonce: number,
): Promise<IPermitMessageData> => {
  const tokenContract = BaseERC20__factory.connect(tokenAddress, signer);

  const domain: TypedDataDomain = {
    name: await tokenContract.name(),
    version: tokenVersion,
    chainId: chainId,
    verifyingContract: tokenAddress,
  };

  const types: Record<string, Array<TypedDataField>> = {
    EIP712Domain: [
      {
        name: 'name',
        type: 'string',
      },
      {
        name: 'version',
        type: 'string',
      },
      {
        name: 'chainId',
        type: 'uint256',
      },
      {
        name: 'verifyingContract',
        type: 'address',
      },
    ],
    Permit: [
      {
        name: 'holder',
        type: 'address',
      },
      {
        name: 'spender',
        type: 'address',
      },
      {
        name: 'nonce',
        type: 'uint256',
      },
      {
        name: 'expiry',
        type: 'uint256',
      },
      {
        name: 'allowed',
        type: 'bool',
      },
    ],
  };

  const value: Record<string, any> = {
    holder: signer.address,
    spender: spender,
    nonce: nonce,
    expiry: expiry,
    allowed: true,
  };

  return {
    domain,
    types,
    value,
  };
};

const signData = async (
  signer: SignerWithAddress,
  permitMessageData: IPermitMessageData,
) => {
  try {
    const voidSigner = new VoidSigner(signer.address, signer.provider);
    const res = await voidSigner._signTypedData(
      permitMessageData.domain,
      permitMessageData.types,
      permitMessageData.value,
    );

    return {
      r: res.slice(0, 66),
      s: '0x' + res.slice(66, 130),
      v: Number('0x' + res.slice(130, 132)),
    };
  } catch (e) {
    console.error(e);
  }

  return {
    v: null,
    r: null,
    s: null,
  };
};

export async function signPermit(
  signer: SignerWithAddress,
  chainId: number,
  tokenAddress: string,
  tokenVersion: string,
  spender: string,
  expiry: number,
  nonce: number,
) {
  const messageData = await createPermitMessageData(
    signer,
    chainId,
    tokenAddress,
    tokenVersion,
    spender,
    expiry,
    nonce,
  );
  const sig = await signData(signer, messageData);
  return Object.assign({}, sig, messageData.value);
}
