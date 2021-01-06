import { fail } from 'assert';

export async function expectException(promise, expectedError) {
  try {
    await promise;
  } catch (error) {
    if (error.message.indexOf(expectedError) === -1) {
      const actualError = error.message.replace(
        'Returned error: VM Exception while processing transaction: ',
        '',
      );
      fail(actualError); // , expectedError, 'Wrong kind of exception received');
    }
    return;
  }

  fail('Expected an exception but none was received');
}

export const expectRevert = async (promise, expectedError = 'revert') => {
  await expectException(promise, expectedError);
};

expectRevert.assertion = (promise) => expectException(promise, 'invalid opcode');
expectRevert.outOfGas = (promise) => expectException(promise, 'out of gas');
expectRevert.unspecified = (promise) => expectException(promise, 'revert');
