// Copy text to the clipboard. If the browser refuses (no permission, an old
// WebView), show the text in a dialog, selected, so it can be copied by hand.
// Nothing is sent anywhere.

/**
 * @param {string} text
 * @returns {Promise<boolean>} true if it reached the clipboard
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    showForManualCopy(text);
    return false;
  }
}

/** @param {string} text */
function showForManualCopy(text) {
  let dialog = /** @type {HTMLDialogElement|null} */ (document.getElementById("copy-dialog"));
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "copy-dialog";
    dialog.className = "settings copy-dialog";
    const note = document.createElement("p");
    note.textContent = "Couldn't copy automatically. It's selected below; copy it from here.";
    const area = document.createElement("textarea");
    area.readOnly = true;
    area.rows = 12;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "primary";
    close.textContent = "Done";
    close.addEventListener("click", () => dialog?.close());
    dialog.append(note, area, close);
    document.body.append(dialog);
  }
  const area = /** @type {HTMLTextAreaElement} */ (dialog.querySelector("textarea"));
  area.value = text;
  dialog.showModal();
  area.select();
}

/**
 * Button feedback: swap the label for a moment.
 * @param {HTMLElement} button
 * @param {boolean} ok
 */
export function flash(button, ok) {
  const before = button.dataset.label ?? button.textContent ?? "";
  button.dataset.label = before;
  button.textContent = ok ? "Copied" : "Shown below";
  setTimeout(() => {
    button.textContent = before;
    delete button.dataset.label;
  }, 1500);
}
