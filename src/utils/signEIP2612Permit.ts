import { JsonRpcSigner } from '@ethersproject/providers/lib';
import { BigNumber } from '@ethersproject/bignumber';
import { BaseERC20Factory } from '@src/typings';

export interface SignatureInfo {
  v: number;
  r: string;
  s: string;
  owner: string;
  spender: string;
  value: string;
  nonce: string;
  deadline: string;
}

export const signERC2612Permit = async (
  signer: JsonRpcSigner,
  token: string,
  owner: string,
  spender: string,
  value: BigNumber,
  deadline: BigNumber,
  nonce: BigNumber,
  chainId: number,
): Promise<SignatureInfo> => {
  const message = {
    owner,
    spender,
    value: value.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
  };
  const domain = await _getDomain(signer, token, chainId);
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  console.log({ domain, message });

  const signature = await signer._signTypedData(domain, types, message);

  const parsedVRS = _parseVRS(signature);

  return Object.assign(Object.assign({}, parsedVRS), message);
};

const _getDomain = async (
  signer: JsonRpcSigner,
  token: string,
  chainId: number,
) => {
  const tokenContract = BaseERC20Factory.connect(token, signer);

  const tokenAddress = token;
  const name = await tokenContract.name();

  const domain = {
    name,
    version: '1', // CAUTION! The old arcx token and other BaseERC20 tokens we deployed use the symbol instead of '1' here
    chainId,
    verifyingContract: tokenAddress,
  };

  return domain;
};

const _parseVRS = (sig: string) => {
  return {
    r: sig.slice(0, 66),
    s: '0x' + sig.slice(66, 130),
    v: parseInt(sig.slice(130, 132), 16),
  };
};
