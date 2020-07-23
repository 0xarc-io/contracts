import {
  Contract,
  ContractFactory,
  ContractTransaction,
  EventFilter,
  Signer,
} from "ethers";
import { Listener, Provider } from "ethers/providers";
import {
  Arrayish,
  BigNumber,
  BigNumberish,
  Interface,
  UnsignedTransaction,
  getContractAddress,
} from "ethers/utils";
import {
  TransactionOverrides,
  TypedFunctionDescription,
  TypedEventDescription,
  awaitContractDeployment,
  DeploymentOverrides,
} from ".";

interface PolynomialInterestSetterInterface extends Interface {
  functions: {
    getCoefficients: TypedFunctionDescription<{ encode([]: []): string }>;

    getInterestRate: TypedFunctionDescription<{
      encode([, borrowWei, supplyWei]: [
        string,
        BigNumberish,
        BigNumberish
      ]): string;
    }>;

    getMaxAPR: TypedFunctionDescription<{ encode([]: []): string }>;
  };
  events: {};
}

export interface PolynomialInterestSetter extends Contract {
  interface: PolynomialInterestSetterInterface;
  connect(
    signerOrProvider: Signer | Provider | string
  ): PolynomialInterestSetter;
  attach(addressOrName: string): PolynomialInterestSetter;
  deployed(): Promise<PolynomialInterestSetter>;
  on(event: EventFilter | string, listener: Listener): PolynomialInterestSetter;
  once(
    event: EventFilter | string,
    listener: Listener
  ): PolynomialInterestSetter;
  addListener(
    eventName: EventFilter | string,
    listener: Listener
  ): PolynomialInterestSetter;
  removeAllListeners(eventName: EventFilter | string): PolynomialInterestSetter;
  removeListener(eventName: any, listener: Listener): PolynomialInterestSetter;

  getCoefficients(): Promise<Array<BigNumber>>;
  getInterestRate(
    arg0: string,
    borrowWei: BigNumberish,
    supplyWei: BigNumberish
  ): Promise<{ value: BigNumber }>;
  getMaxAPR(): Promise<BigNumber>;

  estimate: {
    getCoefficients(): Promise<BigNumber>;
    getInterestRate(
      arg0: string,
      borrowWei: BigNumberish,
      supplyWei: BigNumberish
    ): Promise<BigNumber>;
    getMaxAPR(): Promise<BigNumber>;
  };
}

export class PolynomialInterestSetter {
  public static at(
    signer: Signer,
    addressOrName: string
  ): PolynomialInterestSetter {
    return this.getFactory(signer).attach(
      addressOrName
    ) as PolynomialInterestSetter;
  }

  public static deploy(
    signer: Signer,
    params: { maxAPR: BigNumberish; coefficients: BigNumberish }
  ): Promise<PolynomialInterestSetter> {
    return this.getFactory(signer).deploy(params) as Promise<
      PolynomialInterestSetter
    >;
  }

  public static getDeployTransaction(
    signer: Signer,
    params: { maxAPR: BigNumberish; coefficients: BigNumberish }
  ): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction(params);
  }

  public static async awaitDeployment(
    signer: Signer,
    params: { maxAPR: BigNumberish; coefficients: BigNumberish },
    overrides?: DeploymentOverrides
  ): Promise<PolynomialInterestSetter> {
    const tx = PolynomialInterestSetter.getDeployTransaction(signer, params);
    return awaitContractDeployment(
      signer,
      PolynomialInterestSetter.ABI,
      tx,
      overrides
    );
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"inputs":[{"components":[{"internalType":"uint128","name":"maxAPR","type":"uint128"},{"internalType":"uint128","name":"coefficients","type":"uint128"}],"internalType":"struct PolynomialInterestSetter.PolyStorage","name":"params","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"constant":true,"inputs":[],"name":"getCoefficients","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"borrowWei","type":"uint256"},{"internalType":"uint256","name":"supplyWei","type":"uint256"}],"name":"getInterestRate","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Interest.Rate","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getMaxAPR","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}]';
  public static Bytecode =
    "0x608060405234801561001057600080fd5b506040516109fb3803806109fb833981810160405261003291908101906101a6565b6000809050600082602001516fffffffffffffffffffffffffffffffff1690505b6000811461007757610100818161006657fe5b0682019150600881901c9050610053565b50606481146100bb576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016100b29061020f565b60405180910390fd5b816000808201518160000160006101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff16021790555060208201518160000160106101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff16021790555090505050506102a0565b60006040828403121561015757600080fd5b610161604061022f565b9050600061017184828501610191565b600083015250602061018584828501610191565b60208301525092915050565b6000815190506101a081610289565b92915050565b6000604082840312156101b857600080fd5b60006101c684828501610145565b91505092915050565b60006101dc601c8361025c565b91507f436f656666696369656e7473206d7573742073756d20746f20313030000000006000830152602082019050919050565b60006020820190508181036000830152610228816101cf565b9050919050565b6000604051905081810181811067ffffffffffffffff8211171561025257600080fd5b8060405250919050565b600082825260208201905092915050565b60006fffffffffffffffffffffffffffffffff82169050919050565b6102928161026d565b811461029d57600080fd5b50565b61074c806102af6000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80631e68607a14610046578063afd4c8d614610064578063e8177dcf14610082575b600080fd5b61004e6100b2565b60405161005b919061063a565b60405180910390f35b61006c6100ec565b60405161007991906105dd565b60405180910390f35b61009c60048036036100979190810190610478565b6101ab565b6040516100a9919061061f565b60405180910390f35b60008060000160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16905090565b606080601060405190808252806020026020018201604052801561011f5781602001602082028038833980820191505090505b509050600080905060008060000160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1690505b6000811461019f57610100818161017257fe5b0683838151811061017f57fe5b6020026020010181815250508180600101925050600881901c905061015f565b50808252819250505090565b6101b36103fd565b60008314156101d357604051806020016040528060008152509050610386565b6101db610410565b60006040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250509050600081600001516fffffffffffffffffffffffffffffffff1690508385106102c55760405180602001604052806301e1338083816102b857fe5b0481525092505050610386565b60008090506000670de0b6b3a76400009050600084602001516fffffffffffffffffffffffffffffffff1690505b600115610353576000610100828161030757fe5b069050600081146103285782810284019350818114156103275750610353565b5b8761033c8a8561038d90919063ffffffff16565b8161034357fe5b049250600882901c9150506102f3565b60405180602001604052806064670de0b6b3a76400006301e1338002028686028161037a57fe5b04815250955050505050505b9392505050565b6000808314156103a057600090506103f7565b60008284029050828482816103b157fe5b04146103f2576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016103e9906105ff565b60405180910390fd5b809150505b92915050565b6040518060200160405280600081525090565b604051806040016040528060006fffffffffffffffffffffffffffffffff16815260200160006fffffffffffffffffffffffffffffffff1681525090565b60008135905061045d816106db565b92915050565b600081359050610472816106f2565b92915050565b60008060006060848603121561048d57600080fd5b600061049b8682870161044e565b93505060206104ac86828701610463565b92505060406104bd86828701610463565b9150509250925092565b60006104d383836105bf565b60208301905092915050565b60006104ea82610665565b6104f4818561067d565b93506104ff83610655565b8060005b8381101561053057815161051788826104c7565b975061052283610670565b925050600181019050610503565b5085935050505092915050565b600061054a60218361068e565b91507f536166654d6174683a206d756c7469706c69636174696f6e206f766572666c6f60008301527f77000000000000000000000000000000000000000000000000000000000000006020830152604082019050919050565b6020820160008201516105b960008501826105bf565b50505050565b6105c8816106d1565b82525050565b6105d7816106d1565b82525050565b600060208201905081810360008301526105f781846104df565b905092915050565b600060208201905081810360008301526106188161053d565b9050919050565b600060208201905061063460008301846105a3565b92915050565b600060208201905061064f60008301846105ce565b92915050565b6000819050602082019050919050565b600081519050919050565b6000602082019050919050565b600082825260208201905092915050565b600082825260208201905092915050565b60006106aa826106b1565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b6106e48161069f565b81146106ef57600080fd5b50565b6106fb816106d1565b811461070657600080fd5b5056fea365627a7a72315820681bdcefc9f2d8d423c727618878795c6edbde7552abfc14a846838f8fa284706c6578706572696d656e74616cf564736f6c63430005100040";
}
