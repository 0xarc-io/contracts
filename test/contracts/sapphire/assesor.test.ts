describe('SapphireAssessor', () => {
  describe('constructor', () => {
    it('reverts if mapper and credit score are null');

    it('initializes the mapper and the credit score');
  });

  describe('#assess', () => {
    it('reverts if lower bound, upper bound or account are empty');

    it('reverts if lower bound is not smaller than upper bound');

    it('reverts if the proof is not valid');

    it('reverts if the score proof is passed and is not valid');

    it('reverts if score is passed but no proof is passed');

    it('reverts if proof is passed but no score');

    it('reverts if the mapper returns a value that is outside the lower and upper bounds');

    it(`returns the upperBound if the user doesn't have an existing score and no proof`, async () => {
      // If there's no score & no proof, pass the lowest credit score to the mapper
    });

    it('returns the correct value given the credit score and a valid proof');
  });

  describe('#setMapper', () => {
    it('reverts if called by non-owner');

    it('reverts if no new mapper is passed');

    it('reverts if the new mapper is the same as the existing one');

    it('sets the new mapper');
  });

  describe('#setCreditScoreContract', () => {
    it('reverts if called by non-owner');

    it('reverts if new address is 0');

    it('reverts if new address is the same as the existing one');

    it('sets the new credit score contract');
  });
});
