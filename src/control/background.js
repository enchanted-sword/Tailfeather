browser.runtime.onInstalled.addListener(async details => {
  console.info(details);

  if (details.reason === 'install' || details.temporary) {
    import(browser.runtime.getURL('/scripts/utils/jsTools.js')).then(({ importFeatures, featureify }) => {
      let installedFeatures, preferences;

      const setupFeatures = async () => {
        installedFeatures = await importFeatures();
        preferences = featureify(installedFeatures, preferences);
        browser.storage.local.set({ preferences });
        console.log(preferences);
      };

      setupFeatures().then(() => browser.tabs.create({ url: '../ui/permissions.html' }));
    });
  } else if (details.reason === 'update') {
    console.log('Updated!');
  }
});