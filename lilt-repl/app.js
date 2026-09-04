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

  var activeTranscript = window.lilTranscripts.ensureActive();
  var activeId = activeTranscript.id;

  function scrollToBottom() {
    output.scrollTop = output.scrollHeight;
  }

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.4) + "px";
  }

  function renderEntryInto(container, source, resultText, isError) {
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

    container.appendChild(entry);
    return entry;
  }

  function addEntry(source, resultText, isError) {
    renderEntryInto(output, source, resultText, isError);
    scrollToBottom();
    window.lilTranscripts.appendEntry(activeId, {
      input: source,
      output: resultText,
      isError: !!isError,
      ts: Date.now(),
    });
  }

  function addHint(text) {
    var hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = text;
    output.appendChild(hint);
  }

  function evaluate(source) {
    // checkpoint 3: still just an echo, wired up for real in a later checkpoint
    return source;
  }

  function replayActiveTranscript() {
    output.innerHTML = "";
    if (activeTranscript.entries.length === 0) {
      addHint("this is a stub: it just echoes back what you type.");
    } else {
      activeTranscript.entries.forEach(function (e) {
        renderEntryInto(output, e.input, e.output, e.isError);
      });
    }
    scrollToBottom();
  }

  replayActiveTranscript();
  autoGrow();

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

  function startNewSession() {
    var t = window.lilTranscripts.createNew("");
    activeTranscript = t;
    activeId = t.id;
    output.innerHTML = "";
    addHint("new session started.");
    renderTranscriptList();
  }

  document.getElementById("clear-output-btn").addEventListener("click", function () {
    output.innerHTML = "";
    window.lilTranscripts.clearEntries(activeId);
    addHint("cleared.");
    renderTranscriptList();
  });

  document.getElementById("new-session-btn").addEventListener("click", startNewSession);
  document.getElementById("settings-new-session-btn").addEventListener("click", startNewSession);

  // ---- transcripts tab ----
  var transcriptList = document.getElementById("transcript-list");
  var transcriptDialog = document.getElementById("transcript-dialog");
  var transcriptNameInput = document.getElementById("transcript-name-input");
  var transcriptViewOutput = document.getElementById("transcript-view-output");
  var transcriptDeleteBtn = document.getElementById("transcript-delete-btn");
  var viewingId = null;

  function formatDate(ts) {
    var d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function renderTranscriptList() {
    var all = window.lilTranscripts.getAll();
    transcriptList.innerHTML = "";

    if (all.length === 0) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "No sessions yet.";
      transcriptList.appendChild(empty);
      return;
    }

    all.forEach(function (t) {
      var isCurrent = t.id === activeId;
      var row = document.createElement("div");
      row.className = "transcript-row" + (isCurrent ? " current" : "");
      row.setAttribute("role", "button");
      row.tabIndex = 0;

      var main = document.createElement("div");
      main.className = "transcript-row-main";

      var nameEl = document.createElement("div");
      nameEl.className = "transcript-row-name";
      nameEl.textContent = t.name || "Untitled session";
      main.appendChild(nameEl);

      var metaEl = document.createElement("div");
      metaEl.className = "transcript-row-meta";
      var count = t.entries.length + (t.entries.length === 1 ? " entry" : " entries");
      metaEl.textContent = (isCurrent ? "current · " : "") + count + " · " + formatDate(t.updatedAt);
      main.appendChild(metaEl);

      row.appendChild(main);

      function open() {
        openTranscriptDialog(t.id);
      }
      row.addEventListener("click", open);
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });

      transcriptList.appendChild(row);
    });
  }

  function openTranscriptDialog(id) {
    var t = window.lilTranscripts.get(id);
    if (!t) return;
    viewingId = id;
    transcriptNameInput.value = t.name || "";
    transcriptViewOutput.innerHTML = "";
    if (t.entries.length === 0) {
      var p = document.createElement("p");
      p.className = "hint";
      p.textContent = "(empty)";
      transcriptViewOutput.appendChild(p);
    } else {
      t.entries.forEach(function (e) {
        renderEntryInto(transcriptViewOutput, e.input, e.output, e.isError);
      });
    }
    transcriptDialog.showModal();
  }

  transcriptNameInput.addEventListener("change", function () {
    if (!viewingId) return;
    window.lilTranscripts.rename(viewingId, transcriptNameInput.value.trim());
    renderTranscriptList();
  });

  transcriptDeleteBtn.addEventListener("click", function () {
    if (!viewingId) return;
    if (!window.confirm("Delete this saved session? This can't be undone.")) return;
    var wasActive = viewingId === activeId;
    window.lilTranscripts.remove(viewingId);
    transcriptDialog.close();
    viewingId = null;
    if (wasActive) {
      startNewSession();
    } else {
      renderTranscriptList();
    }
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
    if (name === "log") {
      renderTranscriptList();
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
    document.querySelectorAll(".swatch").forEach(function (b) {
      b.setAttribute("aria-checked", b.getAttribute("data-theme") === theme ? "true" : "false");
    });
  }

  function applyFont(font) {
    document.documentElement.setAttribute("data-font", font);
    storageSet(STORAGE.font, font);
    document.querySelectorAll("#font-toggle button").forEach(function (b) {
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
