'use strict';

const fs = require('fs');
const {differenceWith} = require('ramda');
const {promisify} = require('util');
const readFile = promisify(fs.readFile);
const kongApi = require('./kong');

const username = "example";
const password = "example";
const adminUrl = "http://localhost:8001";
const waitTimeMs = 500;

async function synchronizeProgram() {
    const kong = kongApi(username, password, adminUrl);

    // from disk
    const backupString = await readFile('example.json', {encoding: 'utf8'});
    const backupData = JSON.parse(backupString);
    const diskApis = backupData.apis;
    const diskPlugins = backupData.plugins;
    const diskConsumers = backupData.consumers;

    // from server
    const serverApis = await kong.apis.allApis();
    const serverPlugins = await kong.plugins.allPlugins();
    const serverConsumers = await kong.consumers.allEnrichedConsumers();

    const delay = millis => new Promise(resolve => setTimeout(_ => resolve(), millis));

    const entityIdComparator = (aEntity, bEntity) => aEntity.id === bEntity.id;

    // detect and remove Consumers on the server that are not present on disk
    const consumersToDeleteFromServer = differenceWith(entityIdComparator, serverConsumers, diskConsumers);
    const consumerIds = consumersToDeleteFromServer.map(eachConsumer => eachConsumer.id);
    if (consumerIds.length > 0) {
        console.log(consumerIds);
        consumerIds.map(async id => await kong.consumers.removeConsumerWithCredentials(id).catch(err => console.log(err.message)));
        console.log('Extra consumers on server have been deleted');
        await delay(3000);
    }

    // detect and remove Plugins on the server that are not present on disk
    const pluginsToDeleteFromServer = differenceWith(entityIdComparator, serverPlugins, diskPlugins);
    const pluginIds = pluginsToDeleteFromServer.map(eachPlugin => eachPlugin.id);
    if (pluginIds.length > 0) {
        console.log(pluginIds);
        pluginIds.map(async id => await kong.plugins.removePlugin(id).catch(err => console.log(err.message)));
        console.log('Extra plugins on server have been deleted');
        await delay(3000);
    }

    // detect and remove APIs on the server that are not present on disk
    const apisToDeleteFromServer = differenceWith(entityIdComparator, serverApis, diskApis);
    const apiIds = apisToDeleteFromServer.map(eachApi => eachApi.id);
    if (apiIds.length > 0) {
        console.log(apiIds);
        apiIds.map(async id => await kong.apis.removeApi(id).catch(err => console.log(err.message)));
        console.log('Extra APIs on server have been deleted');
        await delay(3000);
    }

    // At this point all extra server entities have been removed, now we update all entities from the disk into the server
    console.log('Updating APIs');
    diskApis.map(async eachApi => await kong.apis.createOrUpdateApi(eachApi));
    console.log('API updates complete');

    await delay(3000);

    console.log('Updating Plugins');
    diskPlugins.map(async eachPlugin => await kong.plugins.createOrUpdatePlugin(eachPlugin));
    console.log('Plugin updates complete');

    await delay(3000);

    console.log('Updating Consumers and Credentials');
    diskConsumers.map(async eachConsumer => {
        await kong.consumers.removeConsumerWithCredentials(eachConsumer.id).catch(err => {
            console.log('Could not execute entity request: ' + err.options.method + ' ' + err.options.url);
            console.log('Reason: ' + err.error.message);
        });
        await delay(waitTimeMs);
        return await kong.consumers.createOrUpdateConsumerWithCredentials(eachConsumer, true)
    });
    console.log('Consumer and Credentials updates complete');

    console.log('Synchronization process complete');
    return 'OK';
}

synchronizeProgram();