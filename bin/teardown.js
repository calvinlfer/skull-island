'use strict';

const colors = require('colors');
const kongContext = require('../kong/context');
const kongApi = require('../kong/index');

module.exports = async function teardown(url, username, password) {
  try {
    const context = kongContext(username, password, url);
    const kong = kongApi(context);
    const apis = await kong.apis.allApis();
    const plugins = await kong.plugins.allPlugins();
    const consumers = await kong.consumers.allEnrichedConsumers();

    const consumerIds = consumers.map(eachConsumer => eachConsumer.id);
    consumerIds.map(async id => await kong.consumers.removeConsumerWithCredentials(id).catch(err => console.log(err.message.grey)));
    console.log('Consumer deletion complete'.red);

    const pluginIds = plugins.map(eachPlugin => eachPlugin.id);
    pluginIds.map(async id => await kong.plugins.removePlugin(id).catch(err => console.log(err.message.grey)));
    console.log('Plugin deletion complete'.red);

    const apiNames = apis.map(eachApi => eachApi.name);
    apiNames.map(async name => await kong.apis.removeApi(name).catch(err => console.log(err.message.grey)));
    console.log('API deletion complete'.red.reset);
  } catch (e) {
    console.log(e.message.red)
  } finally {
    console.log(' '.reset);
  }
};
