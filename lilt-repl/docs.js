(function () {
  "use strict";

  var cache = Object.create(null);

  function preprocess(md) {
    return md
      .replace(/^title:.*\n/, "")
      .replace(/^\{\{TOC\}\}\n?/m, "")
      .replace(/^!\[[^\]]*\]\(images\/[^)]*\)\n?/gm, "");
  }

  function renderDoc(panel) {
    var el = panel.querySelector(".doc-content");
    if (!el || el.dataset.loaded === "1") return;
    var src = el.getAttribute("data-doc-src");

    if (cache[src]) {
      el.innerHTML = cache[src];
      el.dataset.loaded = "1";
      return;
    }

    el.innerHTML = '<p class="doc-status">loading…</p>';
    fetch(src)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (md) {
        var html = window.marked.parse(preprocess(md));
        cache[src] = html;
        el.innerHTML = html;
        el.dataset.loaded = "1";
      })
      .catch(function (err) {
        el.innerHTML =
          '<p class="doc-status doc-error">Couldn’t load this reference' +
          (err && err.message ? " (" + err.message + ")" : "") +
          ". If you’re offline and haven’t opened this tab before on this device, it hasn’t been cached yet — reconnect once and revisit.</p>";
      });
  }

  window.lilDocs = { renderDoc: renderDoc };
})();
