'use strict';

const chai = require('chai');
const expect = chai.expect;
const kongContext = require('../lib/kong/context');
const kongApi = require('../lib/kong/index');
const localKongHost = 'http://127.0.0.1:8001';

describe('Kong API Object Specification', () => {
  it('must be able to create a plugin', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    await kong.plugins.createOrUpdatePlugin({
      name: 'correlation-id',
      enabled: true,
      config: {
        header_name: 'X-Request-ID',
        echo_downstream: true,
        generator: 'uuid'
      }
    });

    const plugins = await kong.plugins.allPlugins();
    expect(plugins).to.be.lengthOf(1);
    const firstPlugin = plugins[0];
    expect(firstPlugin.name).to.be.equal('correlation-id');
    expect(firstPlugin.config.header_name).to.be.equal('X-Request-ID');
  });

  it('must be able to remove a plugin', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    await kong.plugins.createOrUpdatePlugin({
      name: "ip-restriction",
      enabled: true,
      config: {
        whitelist: ["127.0.0.1"]
      }
    });

    const plugins = await kong.plugins.allPlugins();
    expect(plugins).to.be.lengthOf(1);
    const pluginId = plugins[0].id;
    await kong.plugins.removePlugin(pluginId);
    const pluginsAgain = await kong.plugins.allPlugins();
    expect(pluginsAgain).to.be.lengthOf(0);
  });

  afterEach(async () => {
    // clean up all entities
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const plugins = await kong.plugins.allPlugins();
    const pluginIds = plugins.map(eachPlugin => eachPlugin.id);
    pluginIds.map(async id => await kong.plugins.removePlugin(id).catch(err => console.log(err.message)));
  });
});

