// Runtime globals the React Native types don't declare: `crypto.getRandomValues`
// comes from react-native-get-random-values (imported first in index.js) and
// `atob` is built into Hermes.
declare global {
  var crypto: { getRandomValues<T extends ArrayBufferView | null>(array: T): T };
  function atob(data: string): string;
}

export {};
