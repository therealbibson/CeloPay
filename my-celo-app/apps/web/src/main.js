import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const state = {
  config: null,
  wallet: {
    isMiniPay: false,
    account: "",
    status: "Checking MiniPay account",
    detail: "MiniPay accounts are linked automatically inside the app.",
  },
  services: { utilities: [], vouchers: [], topups: [] },
  activeCategory: "utilities",
  selectedService: null,
  selectedProviderId: "",
  selectedPlanId: "",
  stablecoin: "USDm",
  amount: 25,
  recipient: "",
  people: ["You", "Roommate"],
  split: null,
  quote: null,
  orders: [],
  notice: "",
};

const categoryLabels = {
  utilities: "Utility bills",
  vouchers: "Gift cards",
  topups: "Airtime & data",
};

const categoryHints = {
  utilities: "Pay electricity, internet, and water bills with a simple split option.",
  vouchers: "Buy digital vouchers for supermarkets, streaming, and food services.",
  topups: "Choose a mobile network, then buy airtime or a data plan instantly.",
};

const icons = {
  bolt: "EL",
  wifi: "WF",
  drop: "WT",
  cart: "SM",
  play: "ST",
  ticket: "GV",
  phone: "AT",
  signal: "DT",
};

const ui = {
  panel: "rounded-lg border border-emerald-950/10 bg-white/90 p-4 shadow-[0_18px_55px_rgba(23,33,29,0.08)] backdrop-blur sm:p-5",
  eyebrow: "text-xs font-extrabold uppercase tracking-wider text-emerald-700",
  muted: "text-sm leading-6 text-stone-500",
  field: "grid gap-2",
  label: "text-sm font-bold text-stone-800",
  input:
    "min-h-12 w-full rounded-lg border border-emerald-950/15 bg-white px-3 text-base text-stone-900 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/20",
  pillButton:
    "min-h-11 rounded-lg border px-3 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-emerald-700/20",
  primary:
    "min-h-12 rounded-lg bg-emerald-700 px-4 text-base font-extrabold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-700/25",
  secondary:
    "min-h-12 rounded-lg border border-emerald-950/15 bg-white px-4 text-base font-extrabold text-stone-800 transition hover:border-emerald-700 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-700/20",
};

const app = document.querySelector("#app");

function normalizeCoinSymbol(symbol) {
  return symbol === "cUSD" ? "USDm" : symbol;
}

function displayCoin(symbol) {
  return symbol === "cUSD" || symbol === "USDm" ? "USDm" : symbol;
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function buttonState(isActive) {
  return isActive
    ? "border-emerald-700 bg-emerald-50 text-emerald-800 shadow-[inset_0_0_0_1px_rgba(4,120,87,0.45)]"
    : "border-emerald-950/15 bg-white text-stone-700 hover:border-emerald-700 hover:bg-emerald-50";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

function currentProviders() {
  return state.selectedService?.providers || [];
}

function currentProvider() {
  return currentProviders().find((provider) => provider.id === state.selectedProviderId) || null;
}

function currentPlans() {
  return currentProvider()?.plans || [];
}

function currentPlan() {
  return currentPlans().find((plan) => plan.id === state.selectedPlanId) || null;
}

function currentAmounts() {
  const provider = currentProvider();
  const service = state.selectedService;
  return provider?.denominations || service?.denominations || [];
}

function resetPurchaseFields() {
  const provider = currentProviders()[0] || null;
  state.selectedProviderId = provider?.id || "";

  const plan = provider?.plans?.[0] || null;
  state.selectedPlanId = plan?.id || "";

  const amounts = provider?.denominations || state.selectedService?.denominations || [];
  state.amount = plan?.amount || amounts[0] || provider?.minAmount || state.selectedService?.minAmount || 1;
  state.recipient = "";
  state.split = null;
  state.quote = null;
}

function setNotice(message) {
  state.notice = message;
  render();
}

function buildPurchasePayload() {
  return {
    serviceId: state.selectedService?.id,
    providerId: state.selectedProviderId,
    planId: state.selectedPlanId || undefined,
    amount: state.amount,
    recipient: state.recipient,
    stablecoin: state.stablecoin,
    metadata: {
      split: state.split?.split || [],
      minipayAccount: state.wallet.isMiniPay ? "linked" : "external-browser",
    },
  };
}

function selectCategory(category) {
  state.activeCategory = category;
  state.selectedService = state.services[category][0] || null;
  resetPurchaseFields();
  render();
}

function selectService(serviceId) {
  state.selectedService = state.services[state.activeCategory].find((item) => item.id === serviceId);
  resetPurchaseFields();
  render();
}

function selectProvider(providerId) {
  state.selectedProviderId = providerId;
  const plan = currentPlans()[0] || null;
  const amounts = currentAmounts();
  state.selectedPlanId = plan?.id || "";
  state.amount = plan?.amount || amounts[0] || currentProvider()?.minAmount || state.selectedService?.minAmount || 1;
  state.quote = null;
  render();
}

function selectPlan(planId) {
  state.selectedPlanId = planId;
  state.amount = currentPlan()?.amount || state.amount;
  state.quote = null;
  render();
}

async function calculateSplit() {
  try {
    state.split = await request("/api/bill-split", {
      method: "POST",
      body: JSON.stringify({ amount: state.amount, people: state.people }),
    });
    state.notice = "Split calculated. Everyone gets a clean stablecoin amount.";
    render();
  } catch (error) {
    setNotice(error.message);
  }
}

async function createQuote() {
  try {
    state.quote = await request("/api/quote", {
      method: "POST",
      body: JSON.stringify(buildPurchasePayload()),
    });
    state.notice = "Quote ready. Confirm purchase when you are happy with the total.";
    render();
  } catch (error) {
    setNotice(error.message);
  }
}

async function purchase(event) {
  event.preventDefault();

  try {
    const paidOrder = await request("/api/purchases", {
      method: "POST",
      body: JSON.stringify(buildPurchasePayload()),
    });

    state.orders = [paidOrder, ...state.orders.filter((item) => item.id !== paidOrder.id)];
    state.quote = null;
    state.notice = `${paidOrder.service.name} purchased from ${paidOrder.provider.name}. Confirmation: ${paidOrder.fulfillmentCode}`;
    render();
  } catch (error) {
    setNotice(error.message);
  }
}

function updateAmount(value) {
  state.amount = Number(value);
  state.split = null;
  state.quote = null;
  render();
}

function updatePeople(value) {
  state.people = value
    .split(",")
    .map((person) => person.trim())
    .filter(Boolean);
  state.split = null;
}

function renderServiceCards() {
  return state.services[state.activeCategory]
    .map(
      (service) => `
        <button class="grid min-h-20 w-full grid-cols-[44px_1fr] items-center gap-3 rounded-lg border bg-white p-3 text-left transition focus:outline-none focus:ring-4 focus:ring-emerald-700/20 ${buttonState(
          state.selectedService?.id === service.id
        )}" data-service="${service.id}" type="button">
          <span class="grid h-11 w-11 place-items-center rounded-lg bg-lime-100 text-sm font-extrabold text-emerald-700">${icons[service.icon] || "SV"}</span>
          <span class="min-w-0">
            <strong class="block truncate text-sm text-stone-900">${service.name}</strong>
            <small class="block truncate text-xs text-stone-500">${service.provider}</small>
          </span>
        </button>
      `
    )
    .join("");
}

function renderProviderControl() {
  const providers = currentProviders();

  if (providers.length === 0) return "";

  return `
    <div class="${ui.field}">
      <label class="${ui.label}" for="provider">Provider or network</label>
      <select class="${ui.input}" id="provider">
        ${providers
          .map(
            (provider) => `
              <option value="${provider.id}" ${state.selectedProviderId === provider.id ? "selected" : ""}>
                ${provider.name}
              </option>
            `
          )
          .join("")}
      </select>
    </div>
  `;
}

function renderPlanControl() {
  const plans = currentPlans();

  if (plans.length === 0) return "";

  return `
    <div class="${ui.field}">
      <label class="${ui.label}" for="plan">Plan</label>
      <select class="${ui.input}" id="plan">
        ${plans
          .map(
            (plan) => `
              <option value="${plan.id}" ${state.selectedPlanId === plan.id ? "selected" : ""}>
                ${plan.label} - ${money(plan.amount)}
              </option>
            `
          )
          .join("")}
      </select>
    </div>
  `;
}

function renderAmountControl() {
  const amounts = currentAmounts();
  const service = state.selectedService;

  if (currentPlans().length > 0) return "";

  if (amounts.length > 0) {
    return `
      <div class="${ui.field}">
        <label class="${ui.label}">Amount</label>
        <div class="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 sm:flex sm:flex-wrap">
          ${amounts
            .map(
              (amount) => `
                <button type="button" class="${ui.pillButton} ${buttonState(Number(state.amount) === amount)}" data-amount="${amount}">
                  ${money(amount)}
                </button>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  return `
    <div class="${ui.field}">
      <label class="${ui.label}" for="amount">Amount in USD</label>
      <input class="${ui.input}" id="amount" name="amount" type="number" min="${currentProvider()?.minAmount || service?.minAmount || 1}" step="0.01" value="${state.amount}" />
    </div>
  `;
}

function renderRecipientControl() {
  const label = currentProvider()?.accountLabel || state.selectedService?.accountLabel || "Recipient";
  const placeholder =
    state.selectedService?.category === "voucher"
      ? "Email or account name for delivery"
      : "Enter account number or phone number";

  return `
    <div class="${ui.field}">
      <label class="${ui.label}" for="recipient">${label}</label>
      <input class="${ui.input}" id="recipient" name="recipient" value="${state.recipient}" placeholder="${placeholder}" />
    </div>
  `;
}

function renderQuote() {
  if (!state.quote) return "";

  return `
    <div class="grid gap-2 sm:grid-cols-3">
      <span class="grid gap-1 rounded-lg border border-emerald-700/15 bg-emerald-50/60 p-3">
        <small class="text-xs text-stone-500">Subtotal</small>
        <strong class="text-stone-900">${money(state.quote.subtotal)}</strong>
      </span>
      <span class="grid gap-1 rounded-lg border border-emerald-700/15 bg-emerald-50/60 p-3">
        <small class="text-xs text-stone-500">Service fee</small>
        <strong class="text-stone-900">${money(state.quote.serviceFee)}</strong>
      </span>
      <span class="grid gap-1 rounded-lg border border-emerald-700/15 bg-emerald-50/60 p-3">
        <small class="text-xs text-stone-500">Total</small>
        <strong class="text-stone-900">${money(state.quote.total)} ${displayCoin(state.quote.stablecoin.symbol)}</strong>
      </span>
    </div>
  `;
}

function renderSplitPanel() {
  if (state.activeCategory !== "utilities") return "";

  return `
    <section class="${ui.panel} grid gap-4">
      <div>
        <p class="${ui.eyebrow}">Bill splitter</p>
        <h2 class="mt-1 text-xl font-extrabold text-stone-900">Share the bill before paying</h2>
      </div>
      <div class="${ui.field}">
        <label class="${ui.label}" for="people">People or account labels</label>
        <input class="${ui.input}" id="people" value="${state.people.join(", ")}" placeholder="You, Ada, Tunde" />
      </div>
      <button class="${ui.secondary} w-full sm:w-max" id="splitBill" type="button">Calculate split</button>
      ${
        state.split
          ? `<div class="grid gap-2">
              ${state.split.split
                .map(
                  (item) => `
                    <span class="flex items-center justify-between gap-3 rounded-lg bg-lime-50 px-3 py-2 text-sm text-stone-700">
                      ${item.person}<strong class="text-stone-950">${money(item.amount)}</strong>
                    </span>
                  `
                )
                .join("")}
            </div>`
          : ""
      }
    </section>
  `;
}

function renderOrders() {
  if (state.orders.length === 0) {
    return `<p class="${ui.muted}">Paid confirmations will appear here after checkout.</p>`;
  }

  return state.orders
    .map(
      (order) => `
        <article class="grid gap-1 rounded-lg bg-lime-50 p-3">
          <span class="text-sm font-bold text-stone-900">${order.service.name}</span>
          <strong class="text-sm text-emerald-700">${money(order.total || order.amount)} ${displayCoin(order.stablecoin.symbol)}</strong>
          <small class="text-xs text-stone-500">${order.provider?.name || "Provider"} - ${order.fulfillmentCode || order.status}</small>
        </article>
      `
    )
    .join("");
}

function renderWalletStatus() {
  const statusClass = state.wallet.isMiniPay
    ? "border-emerald-700/20 bg-emerald-50 text-emerald-900"
    : "border-amber-500/25 bg-amber-50 text-amber-950";

  return `
    <div class="rounded-lg border p-4 ${statusClass}">
      <span class="text-xs font-extrabold uppercase tracking-wider">${state.wallet.isMiniPay ? "MiniPay account" : "MiniPay required"}</span>
      <strong class="mt-1 block text-xl">${state.wallet.status}</strong>
      <small class="mt-2 block text-sm leading-5 opacity-80">${state.wallet.detail}</small>
    </div>
  `;
}

function render() {
  const service = state.selectedService;
  const stablecoins = state.config?.stablecoins || [{ symbol: "USDm" }, { symbol: "USDC" }, { symbol: "USDT" }];

  app.innerHTML = `
    <main class="mx-auto grid w-full max-w-[1440px] gap-4 p-3 text-stone-900 sm:p-5 lg:p-6">
      <section class="relative isolate grid min-h-[480px] overflow-hidden rounded-lg bg-stone-950 p-5 text-white sm:min-h-[360px] sm:p-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:p-12">
        <img class="absolute inset-0 -z-20 h-full w-full object-cover" src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1800&q=80" alt="" />
        <div class="absolute inset-0 -z-10 bg-gradient-to-b from-stone-950/85 via-stone-950/65 to-stone-950/90 lg:bg-gradient-to-r"></div>
        <div class="self-end">
          <p class="${ui.eyebrow} text-lime-200">Stablecoin daily payments</p>
          <h1 class="mt-2 text-5xl font-black leading-none text-white sm:text-7xl">CeloPay</h1>
          <p class="mt-4 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
            Spend USDm, USDC, and USDT on electricity, internet, vouchers, airtime, and mobile data from your MiniPay account.
          </p>
        </div>
        <div class="mt-6 grid gap-3 self-end lg:mt-0">
          ${renderWalletStatus()}
          <div class="rounded-lg border border-white/15 bg-white/90 p-4 text-stone-900 shadow-xl backdrop-blur">
            <span class="text-xs font-extrabold uppercase tracking-wider text-stone-500">Network</span>
            <strong class="mt-1 block text-2xl">${state.config?.network || "Celo"}</strong>
            <small class="mt-2 block text-sm leading-5 text-stone-500">Merchant account is ready for stablecoin checkout.</small>
          </div>
        </div>
      </section>

      <section class="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_320px]">
        <aside class="${ui.panel} grid gap-4">
          <div>
            <p class="${ui.eyebrow}">Choose service</p>
            <h2 class="mt-1 text-xl font-extrabold text-stone-900">${categoryLabels[state.activeCategory]}</h2>
            <p class="${ui.muted} mt-1">${categoryHints[state.activeCategory]}</p>
          </div>
          <div class="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 lg:grid-cols-1">
            ${Object.keys(categoryLabels)
              .map(
                (category) => `
                  <button class="${ui.pillButton} ${buttonState(state.activeCategory === category)}" data-category="${category}" type="button">
                    ${categoryLabels[category]}
                  </button>
                `
              )
              .join("")}
          </div>
          <div class="grid gap-2">${renderServiceCards()}</div>
        </aside>

        <section class="grid gap-4">
          <form class="${ui.panel} grid gap-4" id="checkoutForm">
            <div>
              <p class="${ui.eyebrow}">Checkout</p>
              <h2 class="mt-1 text-xl font-extrabold text-stone-900">${service?.name || "Select a service"}</h2>
              <p class="${ui.muted} mt-1">${service?.description || ""}</p>
            </div>

            ${renderProviderControl()}
            ${renderPlanControl()}
            ${renderAmountControl()}
            ${renderRecipientControl()}

            <div class="${ui.field}">
              <label class="${ui.label}">Stablecoin</label>
              <div class="grid grid-cols-3 gap-2">
                ${stablecoins
                  .map((coin) => {
                    const symbol = normalizeCoinSymbol(coin.symbol);
                    return `
                      <button type="button" class="${ui.pillButton} ${buttonState(state.stablecoin === symbol)}" data-coin="${symbol}">
                        ${displayCoin(symbol)}
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </div>

            ${renderQuote()}

            <div class="flex min-h-14 items-center justify-between gap-4 border-y border-emerald-950/10 py-3">
              <span class="text-sm font-bold text-stone-600">Total</span>
              <strong class="text-right text-lg text-emerald-700">${money(state.quote?.total || state.amount)} ${displayCoin(state.stablecoin)}</strong>
            </div>

            <div class="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
              <button class="${ui.secondary}" id="quoteButton" type="button">Review quote</button>
              <button class="${ui.primary}" type="submit">Confirm purchase</button>
            </div>
          </form>

          ${renderSplitPanel()}
        </section>

        <aside class="${ui.panel} grid gap-4 lg:col-span-2 xl:col-span-1">
          <div>
            <p class="${ui.eyebrow}">Activity</p>
            <h2 class="mt-1 text-xl font-extrabold text-stone-900">Recent payments</h2>
          </div>
          ${state.notice ? `<div class="rounded-lg border border-emerald-700/20 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">${state.notice}</div>` : ""}
          <div class="grid gap-2">${renderOrders()}</div>
        </aside>
      </section>
    </main>
  `;

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => selectCategory(button.dataset.category));
  });

  document.querySelectorAll("[data-service]").forEach((button) => {
    button.addEventListener("click", () => selectService(button.dataset.service));
  });

  document.querySelectorAll("[data-amount]").forEach((button) => {
    button.addEventListener("click", () => updateAmount(button.dataset.amount));
  });

  document.querySelectorAll("[data-coin]").forEach((button) => {
    button.addEventListener("click", () => {
      state.stablecoin = button.dataset.coin;
      state.quote = null;
      render();
    });
  });

  document.querySelector("#provider")?.addEventListener("change", (event) => selectProvider(event.target.value));
  document.querySelector("#plan")?.addEventListener("change", (event) => selectPlan(event.target.value));
  document.querySelector("#amount")?.addEventListener("input", (event) => updateAmount(event.target.value));
  document.querySelector("#recipient")?.addEventListener("input", (event) => {
    state.recipient = event.target.value;
    state.quote = null;
  });
  document.querySelector("#people")?.addEventListener("input", (event) => updatePeople(event.target.value));
  document.querySelector("#splitBill")?.addEventListener("click", calculateSplit);
  document.querySelector("#quoteButton")?.addEventListener("click", createQuote);
  document.querySelector("#checkoutForm")?.addEventListener("submit", purchase);
}

async function initMiniPayAccount() {
  const provider = window.ethereum;

  if (!provider?.isMiniPay) {
    state.wallet = {
      isMiniPay: false,
      account: "",
      status: "Open in MiniPay",
      detail: "In MiniPay, your account is already connected. No separate wallet button is needed.",
    };
    return;
  }

  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    const account = accounts?.[0] || "";
    state.wallet = {
      isMiniPay: true,
      account,
      status: account ? "Account linked" : "MiniPay session ready",
      detail: "Your MiniPay account is connected automatically for checkout.",
    };
  } catch (error) {
    state.wallet = {
      isMiniPay: true,
      account: "",
      status: "MiniPay detected",
      detail: "Your account will be available when MiniPay provides the session.",
    };
  }
}

async function init() {
  try {
    const [config, services, orders] = await Promise.all([
      request("/api/config"),
      request("/api/services"),
      request("/api/orders"),
      initMiniPayAccount(),
    ]);

    state.config = config;
    state.services = services;
    state.orders = orders;
    state.selectedService = services.utilities[0];
    state.stablecoin = normalizeCoinSymbol(config.stablecoins?.[0]?.symbol || "USDm");
    resetPurchaseFields();
  } catch (error) {
    state.notice = `Backend unavailable: ${error.message}`;
    state.config = { network: "Celo", stablecoins: [{ symbol: "USDm" }, { symbol: "USDC" }, { symbol: "USDT" }] };
    await initMiniPayAccount();
  }

  render();
}

init();
