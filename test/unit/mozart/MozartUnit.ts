import { MozartTestArc } from '@src/MozartTestArc';
import { unitFixtureMozart } from '../fixture';

import unitTestMozartOpen from './core/open.test';
import Token from '@src/utils/Token';
import ArcNumber from '../../../src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';

export function unitTestMozart(): void {
  describe('Mozart', function () {
    beforeEach(async function () {
      const { coreV1, synthetic, collateral, oracle, savingsV1 } = await this.loadFixture(
        unitFixtureMozart,
      );

      this.contracts.mozart.coreV1 = coreV1;
      this.contracts.mozart.savingsV1 = savingsV1;

      this.contracts.synthetic.tokenV1 = synthetic;
      this.contracts.collateral = collateral;
      this.contracts.oracle = oracle;

      this.sdks.mozart = await MozartTestArc.init(this.signers.admin);
      await this.sdks.mozart.addSynths({ ETHX: coreV1.address });

      await oracle.setPrice(ArcDecimal.new(1));

      await Token.setStartingBalances(
        collateral.address,
        coreV1.address,
        Object.values(this.signers),
        ArcNumber.new(1000000),
      );
    });

    describe('core', unitTestMozartOpen);
  });
}
