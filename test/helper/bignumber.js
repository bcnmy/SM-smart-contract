const {BigNumber} = require('bignumber.js');

const BigNumberZD = BigNumber.clone({
  DECIMAL_PLACES: 0,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
});

function valueToBigNumber(amount) {
  return new BigNumber(amount.toString());
}

function valueToZDBigNumber(amount) {
  return new BigNumberZD(amount.toString());
}

module.exports = { valueToBigNumber, valueToZDBigNumber }