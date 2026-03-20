"use strict";

{
  const permissions = {
    origins: ["*://*.noterook.net/"],
  };

  console.log(browser.permissions.getAll())

  const button = document.getElementById('grantPermissions');
  button.onclick = async function () {
    const granted = await browser.permissions.request(permissions);
    if (granted) {
      if (document.getElementById('reloadTabs').checked) {
        await browser.tabs.query({ url: '*://*.noterook.net/*' }).then(async tabs => {
          tabs.forEach(tab => browser.tabs.reload(tab.id));
        });
      }
    }
    window.open('./menu.html', '_self');
  };
}
