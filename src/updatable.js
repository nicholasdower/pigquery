export default class Updatable {
  #data;
  #updateListeners = [];

  constructor(data) {
    this.#data = data;
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop in target) {
          const value = Reflect.get(target, prop, receiver);
          if (typeof value === 'function') return value.bind(target);
          return value;
        }
        return this.#data?.[prop];
      },
    });
  }

  update(data) {
    this.#data = data;
    this.#updateListeners.forEach(listener => listener());
  }

  addListener(listener) {
    this.#updateListeners.push(listener);
  }

  removeListener(listener) {
    this.#updateListeners = this.#updateListeners.filter(l => l !== listener);
  }
}
