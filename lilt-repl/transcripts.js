(function () {
  "use strict";

  var KEY = "lilt-repl:transcripts";
  var ACTIVE_KEY = "lilt-repl:activeTranscriptId";

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function uid() {
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function getAll() {
    return load().sort(function (a, b) {
      return b.updatedAt - a.updatedAt;
    });
  }

  function get(id) {
    return (
      load().find(function (t) {
        return t.id === id;
      }) || null
    );
  }

  function getActiveId() {
    try {
      return localStorage.getItem(ACTIVE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setActiveId(id) {
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch (e) {}
  }

  function createNew(name) {
    var list = load();
    var t = {
      id: uid(),
      name: name || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      entries: [],
    };
    list.push(t);
    save(list);
    setActiveId(t.id);
    return t;
  }

  function ensureActive() {
    var id = getActiveId();
    var t = id ? get(id) : null;
    return t || createNew("");
  }

  function appendEntry(id, entry) {
    var list = load();
    var t = list.find(function (x) {
      return x.id === id;
    });
    if (!t) return;
    t.entries.push(entry);
    t.updatedAt = Date.now();
    save(list);
  }

  function rename(id, name) {
    var list = load();
    var t = list.find(function (x) {
      return x.id === id;
    });
    if (!t) return;
    t.name = name;
    t.updatedAt = Date.now();
    save(list);
  }

  function remove(id) {
    save(
      load().filter(function (x) {
        return x.id !== id;
      })
    );
    if (getActiveId() === id) {
      try {
        localStorage.removeItem(ACTIVE_KEY);
      } catch (e) {}
    }
  }

  function clearEntries(id) {
    var list = load();
    var t = list.find(function (x) {
      return x.id === id;
    });
    if (!t) return;
    t.entries = [];
    t.updatedAt = Date.now();
    save(list);
  }

  window.lilTranscripts = {
    getAll: getAll,
    get: get,
    getActiveId: getActiveId,
    createNew: createNew,
    ensureActive: ensureActive,
    appendEntry: appendEntry,
    rename: rename,
    remove: remove,
    clearEntries: clearEntries,
  };
})();
