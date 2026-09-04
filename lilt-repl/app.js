(function () {
  "use strict";

  var STORAGE = {
    theme: "lilt-repl:theme",
    font: "lilt-repl:font",
    tab: "lilt-repl:tab",
  };

  function storageGet(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }

  // ---- REPL ----
  var output = document.getElementById("output");
  var form = document.getElementById("input-form");
  var input = document.getElementById("input");

  function scrollToBottom() {
    output.scrollTop = output.scrollHeight;
  }

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.4) + "px";
  }

  function addEntry(source, resultText, isError) {
    var entry = document.createElement("div");
    entry.className = "entry";

    var prompt = document.createElement("div");
    prompt.className = "prompt";
    prompt.textContent = source;
    entry.appendChild(prompt);

    var result = document.createElement("div");
    result.className = "result" + (isError ? " error" : "");
    result.textContent = resultText;
    entry.appendChild(result);

    output.appendChild(entry);
    scrollToBottom();
  }

  function addHint(text) {
    var hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = text;
    output.appendChild(hint);
  }

  function evaluate(source) {
    // checkpoint 2: still just an echo, wired up for real in a later checkpoint
    return source;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var source = input.value;
    if (source.trim() === "") return;
    addEntry(source, evaluate(source));
    input.value = "";
    autoGrow();
    input.focus();
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", autoGrow);

  addHint("this is a stub: it just echoes back what you type.");
  autoGrow();

  document.getElementById("clear-output-btn").addEventListener("click", function () {
    output.innerHTML = "";
    addHint("cleared.");
  });

  // ---- tabs ----
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));

  function activateTab(name, opts) {
    var found = false;
    tabs.forEach(function (t) {
      var match = t.getAttribute("data-tab") === name;
      if (match) found = true;
      t.classList.toggle("active", match);
      t.setAttribute("aria-selected", match ? "true" : "false");
    });
    if (!found) name = "repl";
    panels.forEach(function (p) {
      p.classList.toggle("active", p.getAttribute("data-panel") === name);
    });
    var panel = document.querySelector('.panel[data-panel="' + name + '"]');
    if (panel && panel.classList.contains("doc-panel") && window.lilDocs) {
      window.lilDocs.renderDoc(panel);
    }
    if (name === "repl" && !(opts && opts.silent)) {
      input.focus();
    }
    storageSet(STORAGE.tab, name);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      activateTab(tab.getAttribute("data-tab"));
    });
  });

  activateTab(storageGet(STORAGE.tab, "repl"), { silent: true });

  // ---- settings dialog ----
  var settingsBtn = document.getElementById("settings-btn");
  var dialog = document.getElementById("settings-dialog");

  settingsBtn.addEventListener("click", function () {
    dialog.showModal();
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    storageSet(STORAGE.theme, theme);
    document
      .querySelectorAll(".swatch")
      .forEach(function (b) {
        b.setAttribute("aria-checked", b.getAttribute("data-theme") === theme ? "true" : "false");
      });
  }

  function applyFont(font) {
    document.documentElement.setAttribute("data-font", font);
    storageSet(STORAGE.font, font);
    document
      .querySelectorAll("#font-toggle button")
      .forEach(function (b) {
        b.setAttribute("aria-checked", b.getAttribute("data-font") === font ? "true" : "false");
      });
  }

  document.querySelectorAll(".swatch").forEach(function (b) {
    b.addEventListener("click", function () {
      applyTheme(b.getAttribute("data-theme"));
    });
  });

  document.querySelectorAll("#font-toggle button").forEach(function (b) {
    b.addEventListener("click", function () {
      applyFont(b.getAttribute("data-font"));
    });
  });

  applyTheme(storageGet(STORAGE.theme, "dusk"));
  applyFont(storageGet(STORAGE.font, "mono"));

  if (document.querySelector('.panel[data-panel="repl"]').classList.contains("active")) {
    input.focus();
  }
})();
