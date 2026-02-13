const NAME = `PigQuery v${chrome.runtime.getManifest().version} ${process.env.NODE_ENV}`;

const logger = {
  log: (...args) => console.log(`${new Date().toISOString()} - LOG - ${NAME} - `, ...args),
  warn: (...args) => console.warn(`${new Date().toISOString()} - WARN - ${NAME} - `, ...args),
  error: (...args) => console.error(`${new Date().toISOString()} - ERROR - ${NAME} - `, ...args),
  debug: (...args) => console.debug(`${new Date().toISOString()} - DEBUG - ${NAME} - `, ...args),
};

export default logger;
