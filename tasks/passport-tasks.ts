import {
  ArcProxyFactory,
  DefaultPassportSkinFactory,
  DefiPassportFactory,
  DefiPassportSkinFactory,
  EarlyPassportSkinFactory,
} from '@src/typings';
import { green, red, yellow } from 'chalk';
import {
  pruneDeployments,
  loadDetails,
  deployContract,
  loadContract,
} from '../deployments/src';
import { task } from 'hardhat/config';
import { DeploymentCategory } from '../deployments/types';
import { verifyContract } from './task-utils';

task('deploy-defi-passport', 'Deploy the Defi Passport NFT contract')
  .addOptionalParam('name', 'Name of the defi passport NFT')
  .addOptionalParam('symbol', 'Symbol of the defi passport NFT')
  .addOptionalParam('ver', 'Version of the deployment')
  .addOptionalParam(
    'skinmanager',
    'Address of the skin manager. Default is deployer',
  )
  .addFlag('implementationonly', 'Only deploy implementation')
  .setAction(async (taskArgs, hre) => {
    const {
      name,
      symbol,
      skinManager,
      implementationonly: implementationOnly,
      ver: version,
    } = taskArgs;

    if (!implementationOnly && (!name || !symbol)) {
      throw Error(`--name and/or --symbol missing`);
    }

    const { network, signer, networkConfig } = await loadDetails(hre);

    await pruneDeployments(network, signer.provider);

    const defiPassportImpl = await deployContract(
      {
        name: 'DefiPassport',
        source: 'DefiPassport',
        data: new DefiPassportFactory(signer).getDeployTransaction(),
        version: Number(version) || 1,
        type: DeploymentCategory.global,
        group: 'DefiPassport',
      },
      networkConfig,
    );

    await verifyContract(hre, defiPassportImpl);
    if (implementationOnly) {
      return;
    }

    const defiPassportProxy = await deployContract(
      {
        name: 'DefiPassportProxy',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          defiPassportImpl,
          await signer.getAddress(),
          [],
        ),
        version: 1,
        type: DeploymentCategory.global,
        group: 'DefiPassport',
      },
      networkConfig,
    );

    if (defiPassportProxy) {
      console.log(
        green(
          `DefiPassportProxy successfully deployed at ${defiPassportProxy}`,
        ),
      );
    } else {
      throw red(`DefiPassportProxy was not deployed!`);
    }

    const defiPassportProxyContract = DefiPassportFactory.connect(
      defiPassportProxy,
      signer,
    );

    console.log(
      yellow(`Calling init({
      name: ${name},
      symbol: ${symbol},
      skinManager: ${skinManager || (await signer.getAddress())}
    })...`),
    );
    await defiPassportProxyContract.init(
      name,
      symbol,
      skinManager || (await signer.getAddress()),
    );
    console.log(green(`Init successfully called`));

    await verifyContract(
      hre,
      defiPassportProxy,
      defiPassportImpl,
      await signer.getAddress(),
      [],
    );
  });

task(
  'deploy-default-passport-skin',
  'Deploy the Default Passport skin NFT contract',
)
  .addParam('name', 'The name of the NFT')
  .addParam('symbol', 'The symbol of the NFT')
  .addParam('baseuri', 'The base URI of the tokens')
  .setAction(async (taskArgs, hre) => {
    const { name, symbol, baseuri } = taskArgs;
    const { network, signer, networkConfig } = await loadDetails(hre);

    await pruneDeployments(network, signer.provider);

    const defaultPassportSkinNft = await deployContract(
      {
        name: 'DefaultPassportSkin',
        source: 'DefaultPassportSkin',
        data: new DefaultPassportSkinFactory(signer).getDeployTransaction(
          name,
          symbol,
        ),
        version: 1,
        type: DeploymentCategory.global,
      },
      networkConfig,
    );

    if (!defaultPassportSkinNft) {
      throw red(`Default passport skin NFT not deployed!`);
    }

    console.log(
      green(`Default passport skin NFT deployed at ${defaultPassportSkinNft}`),
    );

    await verifyContract(hre, defaultPassportSkinNft, name, symbol);

    const nftContract = DefaultPassportSkinFactory.connect(
      defaultPassportSkinNft,
      signer,
    );
    if (baseuri) {
      console.log(yellow(`Setting base URI ${baseuri}...`));
      await nftContract.setBaseURI(baseuri);
      console.log(green(`Setting base URI set successfully`));
    }

    const totalTokens = await nftContract.totalSupply();
    if (totalTokens.isZero()) {
      console.log(yellow(`Creating the first three default skins...`));

      for (let i = 1; i <= 3; i++) {
        console.log(yellow(`\nMinting NFT ${i}...`));
        await nftContract.mint(signer.address, i.toString());
        console.log(green(`Token ${i} minted successfully!`));
      }

      console.log(green(`The default skins were successfully minted`));
    }
  });

task(
  'deploy-defi-passport-skin',
  'Deploy the Defi Passport Skin ERC721 contract',
).setAction(async (_taskArgs, hre) => {
  const { network, signer, networkConfig } = await loadDetails(hre);

  await pruneDeployments(network, signer.provider);

  const defiPassportSkinAddress = await deployContract(
    {
      name: 'DefiPassportSkin',
      source: 'DefiPassportSkin',
      data: new DefiPassportSkinFactory(signer).getDeployTransaction(),
      version: 1,
      type: DeploymentCategory.global,
      group: 'DefiPassport',
    },
    networkConfig,
  );

  await verifyContract(hre, defiPassportSkinAddress);
});

task(
  'approve-multiple-skins',
  'Approves multiple skins at the same time. Requires manual editing of the array containing the skins',
)
  .addParam('passport', 'Address of the defi passport')
  .setAction(async (taskArgs, hre) => {
    const { passport } = taskArgs;
    const { signer, network } = await loadDetails(hre);

    const defiPassport = DefiPassportFactory.connect(passport, signer);

    const skinsToApprove = [
      {
        skin: '0xabEFBc9fD2F806065b4f3C237d4b59D9A97Bcac7',
        skinTokenIdStatuses: [
          {
            tokenId:
              '100100431946015156904354094893990264663951307983252928367097329336158108254209',
            status: false,
          },
          {
            tokenId:
              '103572480757087316480440017328614490014721831480524380788522364063107084451841',
            status: false,
          },
          {
            tokenId:
              '103572480757087316480440017328614490014721831480524380788522364062007572824065',
            status: false,
          },
          {
            tokenId:
              '100100431946015156904354094893990264663951307983252928367097329337257619881985',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321704964309385217',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321709362355896321',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321711561379151873',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321710461867524097',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321707163332640769',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321708262844268545',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321714859914035201',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321713760402407425',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321712660890779649',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321717058937290753',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321706063821012993',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321715959425662977',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321726954541940737',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321725855030312961',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321723656007057409',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321728054053568513',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321724755518685185',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321719257960546305',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321718158448918529',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321720357472174081',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321721456983801857',
            status: false,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321722556495429633',
            status: false,
          },
        ],
      },
      {
        skin: '0x495f947276749Ce646f68AC8c248420045cb7b5e',
        skinTokenIdStatuses: [
          {
            tokenId:
              '100100431946015156904354094893990264663951307983252928367097329336158108254209',
            status: true,
          },
          {
            tokenId:
              '103572480757087316480440017328614490014721831480524380788522364063107084451841',
            status: true,
          },
          {
            tokenId:
              '103572480757087316480440017328614490014721831480524380788522364062007572824065',
            status: true,
          },
          {
            tokenId:
              '100100431946015156904354094893990264663951307983252928367097329337257619881985',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321704964309385217',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321709362355896321',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321711561379151873',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321710461867524097',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321707163332640769',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321708262844268545',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321714859914035201',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321713760402407425',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321712660890779649',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321717058937290753',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321706063821012993',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321715959425662977',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321726954541940737',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321725855030312961',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321723656007057409',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321728054053568513',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321724755518685185',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321719257960546305',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321718158448918529',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321720357472174081',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321721456983801857',
            status: true,
          },
          {
            tokenId:
              '75685692659921132146541619680153300115128635339872877657167321722556495429633',
            status: true,
          },
        ],
      },
    ];

    console.log(yellow(`Approving skins...`));
    const tx = await defiPassport.setApprovedSkins(skinsToApprove);
    console.log(
      yellow(
        `https://${network === 'rinkeby' ? 'rinkeby.' : ''}etherscan.io/tx/${
          tx.hash
        }`,
      ),
    );

    await tx.wait();
    console.log(green(`Transaction completed.`));
  });

task('deploy-early-skin', 'Deploys the EarlyPassportSkin NFT').setAction(
  async (_taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadDetails(hre);

    const defiPassportAddress = loadContract({
      network,
      name: 'DefiPassportProxy',
    }).address;

    const earlyPassportAddr = await deployContract(
      {
        name: 'EarlyPassportSkin',
        source: 'EarlyPassportSkin',
        data: new EarlyPassportSkinFactory(signer).getDeployTransaction(
          defiPassportAddress,
        ),
        version: 1,
        type: DeploymentCategory.global,
        group: undefined,
      },
      networkConfig,
    );

    await verifyContract(hre, earlyPassportAddr, defiPassportAddress);
  },
);
