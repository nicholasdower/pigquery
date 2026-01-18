const applyI18n = () => {
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const message = chrome.i18n.getMessage(element.getAttribute('data-i18n'));
    if (message) element.textContent = message;
  });
}
applyI18n();

document.getElementById('options-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
