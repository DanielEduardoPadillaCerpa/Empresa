const { crearPaymentProvider } = require('./paymentProvider');

let provider;

function getPaymentProvider() {
  if (!provider) provider = crearPaymentProvider();
  return provider;
}

module.exports = { getPaymentProvider };
