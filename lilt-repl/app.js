(function () {
  "use strict";

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

  function addEntry(source, resultText) {
    var entry = document.createElement("div");
    entry.className = "entry";

    var prompt = document.createElement("div");
    prompt.className = "prompt";
    prompt.textContent = source;
    entry.appendChild(prompt);

    var result = document.createElement("div");
    result.className = "result";
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
    // checkpoint 1: just echo whatever came in
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
  input.focus();
  autoGrow();
})();
