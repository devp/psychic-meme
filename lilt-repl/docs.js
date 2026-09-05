(function () {
  "use strict";

  var cache = Object.create(null);
  var indexCache = Object.create(null);

  function preprocess(md) {
    return md
      .replace(/^title:.*\n/, "")
      .replace(/^\{\{TOC\}\}\n?/m, "")
      .replace(/^!\[[^\]]*\]\(images\/[^)]*\)\n?/gm, "");
  }

  function slugify(text) {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "section"
    );
  }

  // Assign a stable id to each heading and record a flat outline, so a
  // "jump to section" list can be built for any doc regardless of whether
  // its own markdown happened to define a {{TOC}}.
  function buildIndex(el) {
    var used = Object.create(null);
    var items = [];
    el.querySelectorAll("h2, h3").forEach(function (h) {
      var text = h.textContent.trim();
      if (!text) return;
      var base = slugify(text);
      var id = base;
      var n = 1;
      while (used[id]) id = base + "-" + ++n;
      used[id] = true;
      h.id = id;
      items.push({ id: id, text: text, level: h.tagName === "H2" ? 2 : 3 });
    });
    return items;
  }

  function renderDoc(panel) {
    var el = panel.querySelector(".doc-content");
    if (!el) return;
    var src = el.getAttribute("data-doc-src");
    if (el.dataset.loaded === "1") return;

    if (cache[src]) {
      el.innerHTML = cache[src];
      el.dataset.loaded = "1";
      indexCache[src] = buildIndex(el);
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
        indexCache[src] = buildIndex(el);
      })
      .catch(function (err) {
        el.innerHTML =
          '<p class="doc-status doc-error">Couldn’t load this reference' +
          (err && err.message ? " (" + err.message + ")" : "") +
          ". If you’re offline and haven’t opened this tab before on this device, it hasn’t been cached yet — reconnect once and revisit.</p>";
      });
  }

  function getIndex(panel) {
    var el = panel && panel.querySelector(".doc-content");
    var src = el && el.getAttribute("data-doc-src");
    return (src && indexCache[src]) || [];
  }

  window.lilDocs = { renderDoc: renderDoc, getIndex: getIndex };
})();
