const { BigNumber } = require('ethers');

const { valueToZDBigNumber } = require('./bignumber');

function getRewards(
  balance,
  assetIndex,
  userIndex,
  precision=18
) {
  return BigNumber.from(
    valueToZDBigNumber(balance)
      .multipliedBy(valueToZDBigNumber(assetIndex).minus(userIndex.toString()))
      .dividedBy(valueToZDBigNumber(10).exponentiatedBy(precision))
      .toString()
  );
}

module.exports = { getRewards }