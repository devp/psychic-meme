// Normally supplied by Decker's build step (see js/repl.js); lil.js itself
// references it (sys.version) without defining it.
window.VERSION = "1.70";

(function () {
  "use strict";

  // A browser-hosted equivalent of Decker's Lilt CLI REPL (js/repl.js in
  // JohnEarnest/Decker), minus the filesystem/OS bindings that don't make
  // sense in a browser (read, write, dir, shell, exit, import, newdeck).
  var env = lmenv();

  function n_print(args) {
    return { text: ls(args.length > 1 ? dyad.format(args[0], lml(args.slice(1))) : args[0]) };
  }

  function n_show(args) {
    return { text: args.map(function (x) { return show(x, args.length === 1); }).join(" "), value: args[0] };
  }

  var printed = [];

  env.local("print", lmnat(function (args) {
    printed.push(n_print(args).text);
    return NIL;
  }));
  env.local("show", lmnat(function (args) {
    var r = n_show(args);
    printed.push(r.text);
    return r.value === undefined ? NIL : r.value;
  }));
  env.local("random", lmnat(n_random));
  env.local("array", lmnat(n_array));
  env.local("image", lmnat(n_image));
  env.local("sound", lmnat(n_sound));
  env.local("keystore", lmnat(n_keystore));
  env.local("eval", lmnat(n_eval));
  env.local("writecsv", lmnat(n_writecsv));
  env.local("readcsv", lmnat(n_readcsv));
  env.local("writexml", lmnat(n_writexml));
  env.local("readxml", lmnat(n_readxml));
  env.local("alert", lmnat(function () { return ONE; }));
  env.local("panic", lmnat(function () { return NIL; }));
  constants(env);

  function runProgram(prog) {
    pushstate(env);
    issue(env, prog);
    while (running()) runop();
    var r = arg();
    popstate();
    return r;
  }

  function formatError(e) {
    if (e && typeof e === "object" && "x" in e) {
      return "(" + (e.r + 1) + ":" + (e.c + 1) + ") " + e.x;
    }
    if (e instanceof Error) return e.message;
    return String(e);
  }

  function evaluate(source) {
    printed = [];
    var lines = [];
    var isError = false;
    try {
      var value = runProgram(parse(source));
      env.local("_", value);
      var resultText = show(value, true);
      lines = printed.concat(resultText === "" ? [] : [resultText]);
    } catch (e) {
      isError = true;
      lines = printed.concat([formatError(e)]);
    }
    return { text: lines.join("\n"), isError: isError };
  }

  window.lilRepl = { evaluate: evaluate };
})();
