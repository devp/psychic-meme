-- tinker: highlights + build-on-save diagnostics for *.tinker.md.
-- Highlights use matchadd, so they layer over treesitter markdown.

local root = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h:h:h")
local build = root .. "/build.js"
local ns = vim.api.nvim_create_namespace("tinker")
local aug = vim.api.nvim_create_augroup("tinker", { clear = true })

local function is_tinker(buf)
  return vim.api.nvim_buf_get_name(buf):match("%.tinker%.md$") ~= nil
end

for name, link in pairs({
  TinkerKind = "Keyword",
  TinkerId = "Function",
  TinkerField = "Label",
  TinkerRef = "Underlined",
  TinkerTag = "Special",
  TinkerWho = "Constant",
  TinkerQuestion = "Todo",
  TinkerBlocker = "Error",
  TinkerFlag = "WarningMsg",
  TinkerArrow = "Operator",
}) do
  vim.api.nvim_set_hl(0, name, { link = link, default = true })
end

local patterns = {
  { "TinkerKind", [[\v^\s*([-*+]|\d+[.)])\s+\zs(goal|given|rule|effect|stub|table)>]] },
  { "TinkerId", [[\v^\s*([-*+]|\d+[.)])\s+(goal|given|rule|effect|stub|table)\s+\zs[a-zA-Z0-9_-]+]] },
  { "TinkerField", [[\v^\s*([-*+]|\d+[.)])\s+\zs(needs|serves|hurts|slot|resolves|log):]] },
  { "TinkerField", [[\v\s\zs(serves|hurts):]] },
  { "TinkerRef", [=[\v\[\[[a-zA-Z0-9_-]+\]\]]=] },
  { "TinkerTag", [[\v(^|\s)\zs#[a-zA-Z0-9_-]+]] },
  { "TinkerWho", [[\v(^|\s)\zs\@[a-zA-Z0-9_-]+]] },
  { "TinkerQuestion", [[\v^\s*(([-*+]|\d+[.)])\s+)?\zs\?\s.*]] },
  { "TinkerBlocker", [[\v^\s*(([-*+]|\d+[.)])\s+)?\zs\?!\s.*]] },
  { "TinkerFlag", [[\v^\s*(([-*+]|\d+[.)])\s+)?\zs!\s.*]] },
  { "TinkerArrow", [[\v\s\zs--\>\ze\s]] },
}

-- Matches are window-local: add/remove as buffers move between windows.
local function sync(win, buf)
  local ids = vim.w[win].tinker_ids
  if is_tinker(buf) and not ids then
    ids = {}
    for _, p in ipairs(patterns) do
      table.insert(ids, vim.fn.matchadd(p[1], p[2], 20, -1, { window = win }))
    end
    vim.w[win].tinker_ids = ids
  elseif ids and not is_tinker(buf) then
    for _, id in ipairs(ids) do
      pcall(vim.fn.matchdelete, id, win)
    end
    vim.w[win].tinker_ids = nil
  end
end

local function check(buf)
  local file = vim.api.nvim_buf_get_name(buf)
  vim.system({ "node", build, file }, { text = true }, vim.schedule_wrap(function(r)
    if not vim.api.nvim_buf_is_valid(buf) then return end
    local diags = {}
    for line in (r.stdout or ""):gmatch("[^\n]+") do
      local lnum, sev, msg = line:match("^.-:(%d+):(%a+): (.*)$")
      if lnum then
        table.insert(diags, {
          lnum = tonumber(lnum) - 1,
          col = 0,
          severity = sev == "warn" and vim.diagnostic.severity.WARN or vim.diagnostic.severity.HINT,
          message = msg,
          source = "tinker",
        })
      end
    end
    vim.diagnostic.set(ns, buf, diags)
    local summary = (r.stderr or ""):gsub("%s+$", "")
    if r.code ~= 0 then
      vim.notify(summary, vim.log.levels.ERROR)
    else
      vim.api.nvim_echo({ { summary } }, false, {})
    end
  end))
end

vim.api.nvim_create_autocmd("BufWinEnter", {
  group = aug,
  callback = function(ev) sync(vim.api.nvim_get_current_win(), ev.buf) end,
})

vim.api.nvim_create_autocmd({ "BufReadPost", "BufWritePost" }, {
  group = aug,
  pattern = "*.tinker.md",
  callback = function(ev) check(ev.buf) end,
})

vim.api.nvim_create_user_command("TinkerOpen", function()
  vim.ui.open((vim.api.nvim_buf_get_name(0):gsub("%.tinker%.md$", ".html")))
end, { desc = "Open the built .html for this game" })
