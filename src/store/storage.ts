import storage from "redux-persist/lib/storage";

// redux-persist's default storage engine touches `window.localStorage` the
// moment its methods are called. Next.js still executes "use client" module
// code during SSR, so a real persistor created at that point would crash
// with "window is not defined" — fall back to a no-op engine on the server.
const noopStorage = {
  getItem(_key: string) {
    return Promise.resolve(null);
  },
  setItem(_key: string, value: string) {
    return Promise.resolve(value);
  },
  removeItem(_key: string) {
    return Promise.resolve();
  },
};

export default typeof window !== "undefined" ? storage : noopStorage;
