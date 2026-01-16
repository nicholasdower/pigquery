const STORAGE_KEY = "userPayload";

const el = (id) => document.getElementById(id);

const textarea = el("payload");
const saveBtn = el("save");
const statusEl = el("status");

function setStatus(message, kind = "muted") {
  statusEl.className = kind;
  statusEl.textContent = message;
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

async function load() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  textarea.value = data[STORAGE_KEY] ?? "";
  setStatus("Loaded");
}

async function save() {
  const raw = textarea.value;
  if (raw.trim() === '') {
    await chrome.storage.local.remove(STORAGE_KEY);
    textarea.value = '';
    setStatus("Saved", "ok");
    return;
  }

  const parsed = safeJsonParse(raw.trim() === "" ? "null" : raw);
  if (!parsed.ok) {
    setStatus(`Invalid JSON: ${parsed.error.message}`, "error");
    return;
  }
  const config = parsed.value;
  if (typeof config !== "object" || config === null) {
    setStatus("Invalid Config: object expected", "error");
    return;
  }
  if (!Array.isArray(config.insertOptions)) {
    setStatus("Invalid Config: insertOptions array missing", "error");
    return;
  }
  for (const option of config.insertOptions) {
    if (typeof option.description !== "string" || option.description.trim() === "") {
      setStatus("Invalid Config: insertOptions.description missing", "error");
      return;
    }
    if (typeof option.type !== "string" || option.type.trim() === "") {
      setStatus("Invalid Config: insertOptions.type missing", "error");
      return;
    }
    if (typeof option.value !== "string" || option.value.trim() === "") {
      setStatus("Invalid Config: insertOptions.value missing", "error");
      return;
    }
  }
  if (!Array.isArray(config.clickOptions)) {
    setStatus("Invalid Config: clickOptions array missing", "error");
    return;
  }
  for (const option of config.clickOptions) {
    if (typeof option.label !== "string" || option.label.trim() === "") {
      setStatus("Invalid Config: clickOptions.label missing", "error");
      return;
    }
    if (typeof option.regex !== "string" || option.regex.trim() === "") {
      setStatus("Invalid Config: clickOptions.regex missing", "error");
      return;
    }
    if (typeof option.url !== "string" || option.url.trim() === "") {
      setStatus("Invalid Config: clickOptions.url missing", "error");
      return;
    }
    try {
      new RegExp(option.regex);
    } catch (e) {
      setStatus("Invalid Config: clickOptions.regex invalid", "error");
      return;
    }
    if (!option.url.includes("%s")) {
      setStatus("Invalid Config: clickOptions.url must include %s", "error");
    }
  }

  const pretty = JSON.stringify(config, null, 2);
  textarea.value = pretty;

  await chrome.storage.local.set({ [STORAGE_KEY]: pretty });

  setStatus("Saved", "ok");
}

saveBtn.addEventListener("click", () => void save());

// Ctrl/Cmd+S saves
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    void save();
  }
});

void load();
