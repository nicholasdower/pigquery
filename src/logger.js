// Lazy load the name to avoid errors when the extension is not yet loaded
const getName = (() => {
  let cached;
  return () => {
    if (cached) return cached;
    try {
      const version = chrome?.runtime?.getManifest()?.version;
      if (version) {
        cached = `PigQuery v${version} ${process.env.NODE_ENV}`;
        return cached;
      }
    } catch (e) {
      return `PigQuery v(unknown) ${process.env.NODE_ENV}`;
    }
  };
})();

const logger = {
  log: (...args) => console.log(`${new Date().toISOString()} - LOG - ${getName()} - `, ...args),
  warn: (...args) => console.warn(`${new Date().toISOString()} - WARN - ${getName()} - `, ...args),
  error: (...args) => console.error(`${new Date().toISOString()} - ERROR - ${getName()} - `, ...args),
  debug: (...args) => console.debug(`${new Date().toISOString()} - DEBUG - ${getName()} - `, ...args),
};

export default logger;
