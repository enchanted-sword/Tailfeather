'use strict';

{
  console.info('Initialising PawJob...');

  const { getURL } = browser.runtime;
  const urlPrefix = getURL('');

  const preloadStyles = async () => {
    const t0 = Date.now();
    const { extensionStyles } = await browser.storage.local.get('extensionStyles');

    const style = Object.assign(document.createElement('style'), {
      id: 'tailfeather-extensionStyles',
      textContent: extensionStyles
    });

    document.documentElement.append(style);
    console.info(`Preloaded stylesheets in ${Date.now() - t0}ms`);
  };
  preloadStyles();

  const cacheExtensionStyles = () => {
    const extensionStyles = Array.from(document.styleSheets)
      ?.filter(sheet => sheet.ownerNode?.matches('.tailfeather-style') || sheet.href?.includes(urlPrefix))
      .flatMap(sheet => {
        try {
          return Array.from(sheet.cssRules)
        } catch (e) {
          console.error(e, sheet);
          return void 0;
        }
      })
      .filter(rule => !!rule)
      .map(rule => rule.cssText)
      .join('\n');

    browser.storage.local.set({ extensionStyles });
  };
  const styleObserver = new MutationObserver(mutations => {
    const changedNodes = mutations
      .flatMap(({ addedNodes, removedNodes }) => [...addedNodes, ...removedNodes])
      .filter(node => node instanceof Element)
      .filter(node => node.matches('.tailfeather-style'));

    if (changedNodes.length) cacheExtensionStyles
  });
  styleObserver.observe(document.documentElement, { childList: true, subtree: true });

  (async () =>
    import(browser.runtime.getURL('/scripts/utils/jsTools.js')).then(({ debounce, deepEquals, importFeatures, featureify }) => {  // browser.runtime.getURL is only a valid escape when written in full
      let installedFeatures = {};
      let enabledFeatures = [];
      let resizeListeners = [];
      let preferences = {};
      const preferenceListeners = {};

      const executeFeature = async name => {
        const feature = installedFeatures[name];

        try {
          if (feature.desktopOnly || feature.mobileOnly && !resizeListeners.includes(name)) resizeListeners.push(name);
          if (feature.css) {
            const link = Object.assign(document.createElement('link'), {
              id: `tailfeather-styles-${name}`,
              class: 'tailfeather-style',
              rel: 'stylesheet',
              href: getURL(`/scripts/${name}.css`)
            });

            document.documentElement.appendChild(link);
          }
          if (feature.js) {
            const { main, clean, update } = await import(browser.runtime.getURL(`/scripts/${name}.js`)); // browser.runtime.getURL is only a valid escape when written in full

            window.requestAnimationFrame(() => main().catch(console.error));

            preferenceListeners[name] = (changes, areaName) => {
              const { preferences } = changes;
              if (areaName !== 'local' || typeof preferences === 'undefined') return;
              const newPref = preferences.newValue[name];
              const oldPref = preferences.oldValue[name];

              const changed = Object.keys(preferences.newValue).filter(key => !deepEquals(preferences?.newValue[key], preferences?.oldValue[key]));
              if ((changed.includes(name) && newPref.enabled === true)
                || feature.recieveUpdates?.some(key => changed.includes(key))) {
                if (update instanceof Function && 'options' in newPref) {
                  const diff = Object.entries(newPref.options).filter(([key, val]) => !deepEquals(val, oldPref.options[key]));
                  update(newPref.options, Object.fromEntries(diff));
                }
                else clean().then(main);
              }
            };

            browser.storage.onChanged.addListener(preferenceListeners[name]);
          }
        } catch (e) { console.error(`Failed to execute feature ${name}`, e, 'IF THIS IS A "FAILED TO IMPORT DYNAMIC MODULE" ERROR, ENABLE WARNINGS IN THE BROWSER CONSOLE TO DISPLAY IMPORT PATH ERRORS'); }
      };
      const destroyFeature = async name => {
        const feature = installedFeatures[name];

        try {
          if (feature.css) document.querySelector(`link[href='${getURL(`/scripts/${name}.css`)}']`)?.remove();
          if (feature.js) {
            const { clean } = await import(browser.runtime.getURL(`/scripts/${name}.js`)); // browser.runtime.getURL is only a valid escape when written in full

            window.requestAnimationFrame(() => clean().catch(console.error));

            if (browser.storage.onChanged.hasListener(preferenceListeners[name])) browser.storage.onChanged.removeListener(preferenceListeners[name]);
            delete preferenceListeners[name];
          }

          resizeListeners = resizeListeners.filter(val => val !== name);
          enabledFeatures = enabledFeatures.filter(val => val !== name);
        } catch (e) { console.error(`Failed to destroy feature ${name}`, e); }

        return void 0;
      };

      const onStorageChanged = async (changes, areaName) => {
        const { preferences } = changes;
        if (areaName !== 'local' || typeof preferences === 'undefined') return;

        const { oldValue = {}, newValue = {} } = preferences;

        console.info(preferences);

        const newlyEnabled = Object.keys(newValue).filter(feature => !oldValue[feature]?.enabled && newValue[feature]?.enabled);
        const newlyDisabled = Object.keys(oldValue).filter(feature => oldValue[feature]?.enabled && !newValue[feature]?.enabled);

        Promise.all([...newlyEnabled.map(executeFeature), ...newlyDisabled.map(destroyFeature)]).then(cacheExtensionStyles);
        enabledFeatures.push(newlyEnabled);
      };
      const onResized = function () {
        if (window.innerWidth < 990) {
          resizeListeners.forEach(feature => {
            if (installedFeatures[feature]?.desktopOnly && enabledFeatures.includes(feature)) destroyFeature(feature)
              .then(() => resizeListeners.push(feature)); // destroying a feature removes its resize listener, so we re-add it here
            else if (installedFeatures[feature]?.mobileOnly && !enabledFeatures.includes(feature)) {
              enabledFeatures.push(feature);
              executeFeature(feature);
            }
          });
        } else resizeListeners.forEach(feature => {
          if (installedFeatures[feature]?.mobileOnlyOnly && enabledFeatures.includes(feature)) destroyFeature(feature)
            .then(() => resizeListeners.push(feature)); // destroying a feature removes its resize listener, so we re-add it here
          else if (installedFeatures[feature]?.desktopOnly && !enabledFeatures.includes(feature)) {
            enabledFeatures.push(feature);
            executeFeature(feature);
          }
        });
      };

      const initFeatures = async () => {
        // await import(browser.runtime.getURL('/scripts/utils/database.js')).then(({ openDatabase }) => openDatabase()); // ensures the database is created before anything interacts with it
        installedFeatures = await importFeatures();

        ({ preferences } = await browser.storage.local.get('preferences'));

        preferences = featureify(installedFeatures, preferences);
        enabledFeatures = Object.keys(preferences).filter(key => preferences[key].enabled);
        browser.storage.local.set({ preferences });

        if (enabledFeatures.length) Promise.all(enabledFeatures.map(executeFeature)).then(() => document.getElementById('tailfeather-extensionStyles').remove());
        else document.getElementById('tailfeather-extensionStyles').remove();

        browser.storage.onChanged.addListener(onStorageChanged);

        window.addEventListener('resize', debounce(onResized));

        console.info(`Running ${enabledFeatures.length} of ${Object.keys(installedFeatures).length} features`);
      };

      initFeatures();

      console.info('Loaded!');
      console.info(browser.storage.local.get());
    }))();
}