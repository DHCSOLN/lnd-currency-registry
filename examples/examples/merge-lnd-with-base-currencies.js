async function loadCurrencyRegistry() {
  const baseCurrenciesUrl = "https://example.com/base-currencies.json";
  const lndRegistryUrl = "https://raw.githubusercontent.com/DHCSOLN/lnd-currency-registry/main/currencies.json";

  const [baseResponse, lndResponse] = await Promise.all([
    fetch(baseCurrenciesUrl),
    fetch(lndRegistryUrl)
  ]);

  const baseData = await baseResponse.json();
  const lndData = await lndResponse.json();

  const currencies = baseData.currencies || [];
  const lndCurrencies = lndData.currencies || [];

  for (const lndCurrency of lndCurrencies) {
    const exists = currencies.some(
      currency => currency.code === lndCurrency.code
    );

    if (!exists) {
      currencies.push(lndCurrency);
    }
  }

  return currencies;
}

async function populateCurrencyDropdown(dropdownId) {
  const currencies = await loadCurrencyRegistry();
  const dropdown = document.getElementById(dropdownId);

  dropdown.innerHTML = "";

  for (const currency of currencies) {
    const option = document.createElement("option");
    option.value = currency.code;
    option.textContent = `${currency.code} - ${currency.name}`;
    dropdown.appendChild(option);
  }
}
