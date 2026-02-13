// Simple logger with timestamp
// __DEBUG__ is a global constant injected by the build process

const NAME = `PigQuery v${chrome.runtime.getManifest().version}`;

const logger = {
  log: (...args) => console.log(`${new Date().toISOString()} - ${NAME} - LOG - `, ...args),
  warn: (...args) => console.warn(`${new Date().toISOString()} - ${NAME} - WARN - `, ...args),
  error: (...args) => console.error(`${new Date().toISOString()} - ${NAME} - ERROR - `, ...args),
  debug: (...args) => {
    if (__DEBUG__) {
      console.debug(`${new Date().toISOString()} - ${NAME} - DEBUG - `, ...args);
    }
  },
};

export default logger;
