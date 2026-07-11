const listEl = document.getElementById("domain-list");
const emptyMsg = document.getElementById("empty-msg");
const form = document.getElementById("add-form");
const input = document.getElementById("domain-input");
const errorMsg = document.getElementById("error-msg");

function normalizeDomain(raw) {
  let value = raw.trim().toLowerCase();
  if (!value) return "";
  // Allow pasting a full URL; extract just the hostname.
  if (value.includes("://")) {
    try {
      value = new URL(value).hostname;
    } catch {
      // fall through with raw text
    }
  }
  value = value.split("/")[0];
  return value;
}

async function render() {
  let domains = await getAllowedDomains();

  // Purge any previously-allowed domain that's since been hard-blocklisted.
  const purged = domains.filter((d) => !hostnameIsBlocked(d, HARD_BLOCKLIST));
  if (purged.length !== domains.length) {
    domains = purged;
    await setAllowedDomains(domains);
  }

  listEl.innerHTML = "";
  emptyMsg.hidden = domains.length > 0;

  for (const domain of domains) {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.textContent = domain;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const updated = (await getAllowedDomains()).filter((d) => d !== domain);
      await setAllowedDomains(updated);
      render();
    });

    li.append(span, removeBtn);
    listEl.appendChild(li);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.hidden = true;

  const domain = normalizeDomain(input.value);
  if (!domain) return;

  if (hostnameIsBlocked(domain, HARD_BLOCKLIST)) {
    errorMsg.textContent = `"${domain}" is permanently blocked and cannot be allow-listed.`;
    errorMsg.hidden = false;
    return;
  }

  const domains = await getAllowedDomains();
  if (!domains.includes(domain)) {
    domains.push(domain);
    await setAllowedDomains(domains);
  }
  input.value = "";
  render();
});

render();
