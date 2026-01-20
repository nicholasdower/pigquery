const i18n = window.pigquery.i18n;
i18n.applyI18n(i18n.getSystemLocale());

document.getElementById('options-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
