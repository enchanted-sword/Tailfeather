let connectionPort;
let connected = false

const initPort = () => {
  if (!connected) {
    connectionPort = browser.runtime.connect({ name: 'injectPort' });
    connected = true;
    connectionPort.onDisconnect.addListener(() => connected = false);
  }
};

const postData = data => {
  connectionPort.postMessage({ action: 'inject', data }); // structuredClone fails to clone functions
};

export const inject = async (...files) => new Promise(resolve => {
  const hash = crypto.randomUUID();
  initPort();
  connectionPort.onMessage.addListener(m => {
    if (m.hash === hash) resolve(m.results);
  });

  postData({ hash, files });
});