const listEl = document.getElementById("domain-list");
const emptyMsg = document.getElementById("empty-msg");
const form = document.getElementById("add-form");
const input = document.getElementById("domain-input");

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
  const domains = await getAllowedDomains();
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
  const domain = normalizeDomain(input.value);
  if (!domain) return;

  const domains = await getAllowedDomains();
  if (!domains.includes(domain)) {
    domains.push(domain);
    await setAllowedDomains(domains);
  }
  input.value = "";
  render();
});

render();
