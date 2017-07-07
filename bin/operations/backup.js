'use strict';
const fs = require('fs');
const colors = require('colors');
const kongContext = require('../../kong/context');
const kongApi = require('../../kong/index');

module.exports = async function backup(filename, url, username, password) {
  let adjustedFileName = 'kong-backup.json';
  if (filename) {
    adjustedFileName = filename;
  }

  try {
    const context = kongContext(username, password, url);
    const kong = kongApi(context);
    const apis = await kong.apis.allApis();
    const plugins = await kong.plugins.allPlugins();
    const consumers = await kong.consumers.allEnrichedConsumers();
    const results = {apis, plugins, consumers};
    fs.writeFileSync(adjustedFileName, JSON.stringify(results, null, 4));
    console.log(`Backup data has been written to ${adjustedFileName}`.green)
  } catch (e) {
    console.log(e.message.red)
  } finally {
    console.log(' '.reset);
  }
};
