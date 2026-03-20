const fStore = {};

const handler = {
  get(_, prop) {
    let v = sessionStorage.getItem(prop);
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  },
  set(_, prop, value) {
    sessionStorage.setItem(prop, JSON.stringify(value));
    return 1;
  },
  deleteProperty(_, prop) {
    sessionStorage.removeItem(prop);
    return 1;
  }
};

export const store = new Proxy(fStore, handler);

export const local = Object.freeze({
  async get(key) { return (await browser.storage.local.get(key))[key]; },
  async set(val) { return browser.storage.local.set(val) }
})