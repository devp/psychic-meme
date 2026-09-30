// Everything about the language, in one place. The rest of the app is the
// same REPL shell in every pizza-repl-<lang>; swapping this file (plus
// vendor/ and docs/) is the port.
//
// Fennel: vendor/fennel.lua, the Fennel compiler, running on Fengari (a Lua 5.3
// VM in JS, vendor/fengari-web.js, a classic script loaded by index.html).
//
// Rather than eval each entry on its own, this drives Fennel's own REPL, so its
// semantics come for free: locals persist between entries, *1 *2 *3 hold recent
// values, ,help and ,doc work. fennel.repl() is a blocking read loop, so it runs
// in a Lua coroutine whose readChunk yields back here; each evaluate() resumes
// it with one entry and collects what it printed until it asks for more.

/** @type {any} fengari-web's global, untyped */
const fengari = /** @type {any} */ (globalThis).fengari;

export const name = "fennel";
export const comment = ";;";
export const placeholder = "(+ 1 2)";
export const greeting =
  "Fennel REPL — try (+ 1 2) or (print :hi). ,help lists REPL commands. Reference tabs above; the log tab keeps your sessions.";

const BOOT = `
local fennel = ...
package.loaded.fennel = fennel -- fn metadata requires it by name
os.getenv = os.getenv or function() return nil end -- Fengari's os has none; the repl asks for TERM

local out, failed = {}, false
local function emit(text, err)
  table.insert(out, text)
  if err then failed = true end
end

print = function(...)
  local parts = {}
  for i = 1, select("#", ...) do parts[i] = tostring((select(i, ...))) end
  emit(table.concat(parts, "\\t"))
end

local repl
local function start()
  repl = coroutine.create(function()
    fennel.repl({
      ["error-pinpoint"] = false, -- ANSI escapes otherwise
      readChunk = function(parser) return coroutine.yield(parser["stack-size"]) end,
      onValues = function(xs) if #xs > 0 then emit(table.concat(xs, "\\t")) end end,
      onError = function(kind, msg)
        emit((kind == "Runtime" and "Runtime error: " or "") .. tostring(msg), true)
      end,
    })
  end)
  assert(coroutine.resume(repl))
end
start()

return function(src)
  out, failed = {}, false
  local ok, depth = coroutine.resume(repl, src .. "\\n")
  if not ok then
    emit("REPL crashed, restarted; earlier locals are gone: " .. tostring(depth), true)
    start()
  elseif coroutine.status(repl) == "dead" then
    emit("(,exit: REPL restarted; earlier locals are gone)")
    start()
  elseif depth ~= 0 then
    emit("Incomplete input; REPL restarted, earlier locals are gone.", true)
    start()
  end
  return table.concat(out, "\\n"), failed
end
`;

const { lua, lauxlib, lualib, to_luastring } = fengari;
const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);

/** @param {number} status @param {string} what */
function check(status, what) {
  if (status !== lua.LUA_OK) throw new Error(`${what}: ${lua.lua_tojsstring(L, -1)}`);
}

const fennelSource = await (await fetch(new URL("vendor/fennel.lua", import.meta.url))).text();
check(lauxlib.luaL_loadbuffer(L, to_luastring(fennelSource), null, to_luastring("@vendor/fennel.lua")), "load fennel");
check(lua.lua_pcall(L, 0, 1, 0), "run fennel");
check(lauxlib.luaL_loadstring(L, to_luastring(BOOT)), "load boot");
lua.lua_insert(L, -2); // boot(fennel)
check(lua.lua_pcall(L, 1, 1, 0), "run boot");
const evalRef = lauxlib.luaL_ref(L, lua.LUA_REGISTRYINDEX);

/**
 * Each value or print on its own line, in order.
 * @param {string} source
 * @returns {{text: string, isError: boolean}}
 */
export function evaluate(source) {
  // Sent as-is, the repl would sit waiting for the rest of the form, and
  // there's no way to tell it to drop a half-read one short of a restart.
  if (hasUnterminated(source)) {
    return { text: "Incomplete: an unclosed ( [ { or string. Close it and run again.", isError: true };
  }
  lua.lua_rawgeti(L, lua.LUA_REGISTRYINDEX, evalRef);
  lua.lua_pushstring(L, to_luastring(source));
  check(lua.lua_pcall(L, 1, 2, 0), "evaluate");
  const result = { text: lua.lua_tojsstring(L, -2), isError: lua.lua_toboolean(L, -1) };
  lua.lua_pop(L, 2);
  return result;
}

/**
 * An open delimiter or string at end of input. Mirrors Fennel's reader:
 * ; comments to end of line, \ escapes in strings.
 * @param {string} source
 */
export function hasUnterminated(source) {
  let inString = false, inComment = false, depth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (inComment) {
      if (c === "\n") inComment = false;
    } else if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === ";") inComment = true;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if ((c === ")" || c === "]" || c === "}") && depth > 0) depth--;
  }
  return inString || depth > 0;
}

/**
 * Pasting an export runs through the same repl, form by form, so *1 and
 * locals replay faithfully: nothing to warn about.
 * @param {string[]} _inputs
 * @returns {string[]}
 */
export function replayCaveat(_inputs) {
  return [];
}

/**
 * Relative links point at pages of fennel-lang.org.
 * @param {string} md
 */
export function preprocessDoc(md) {
  return md.replace(/\]\((?!https?:|#)\/?([^)#.]+)(?:\.md)?(#[^)]*)?\)/g, "](https://fennel-lang.org/$1$2)");
}
