#!/usr/bin/env node

'use strict';

const fs = require('fs');
const cli = require('commander');
const colors = require('colors');
const {promisify} = require('util');
const readFile = promisify(fs.readFile);
const {is, differenceWith, filter}= require('ramda');
const {version} = require('../package.json');
const kongContext = require('../kong/context');
const kongApi = require('../kong/index');

function checkValidFlagsAndFailFast(url, username, password) {
    if (!url) {
        console.log('Please specify the url (eg. -l http://127.0.0.1:8001)'.yellow);
        process.exit(1);
    }

    if (username && !password) {
        console.log('Please specify both the username (-u) and the password (-p) to enable Basic Authentication'.yellow);
        process.exit(2);
    }
}

function apiHasValidUrl(apiObject) {
  return apiObject.upstream_url.startsWith('http');
}

cli.version(version)
    .option('-u, --username <user>', 'Kong Admin API Username (optional)')
    .option('-p, --password <pass>', 'Kong Admin API Password (optional unless username is specified)')
    .option('-l, --url <url>', 'Kong Admin API URL (eg. http://127.0.0.1:8001)')
    .option('-b --synch-basic-auth-creds', 'Tell the synchronization process to upload basic authentication data ' +
        '(WARNING: passwords must be in plaintext and this is disabled by default). '.red +
        'Do not dump your basic-authentication configuration and attempt to synchronize it, your credentials will stop working. '.bold +
        'You have been warned'.reset
    );

cli.command('backup [filename]')
    .description(
        'Creates a backup configuration of APIs, Plugins, Consumers and Consumer Credentials from the provided Kong API ' +
        'Gateway URL, you can specify the filename where the backup will materialize (defaults to kong-backup.json)'
    )
    .alias('bk')
    .action(async filename => {
        checkValidFlagsAndFailFast(cli.url, cli.username, cli.password);

        let adjustedFileName = 'kong-backup.json';
        if (filename) {
            adjustedFileName = filename;
        }

        try {
            const context = kongContext(cli.username, cli.password, cli.url);
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
    });

cli.command('synchronize [filename]')
    .description(
        'Synchronizes the configuration file (defaults to kong-backup.json) on disk with the configuration on the ' +
        'server. It will remove server entities that are not present in the configuration file and will update the rest ' +
        'of the entities. The default filename is kong-backup.json'
    )
    .alias('sync')
    .action(async filename => {
        checkValidFlagsAndFailFast(cli.url, cli.username, cli.password);
        const synchronizeBasicAuthCreds = cli.synchBasicAuthCreds;

        let adjustedFileName = 'kong-backup.json';
        if (filename) {
            adjustedFileName = filename;
        }

        try {
            const context = kongContext(cli.username, cli.password, cli.url);
            const kong = kongApi(context);

            // from disk
            const backupString = await readFile(adjustedFileName, {encoding: 'utf8'});
            const backupData = JSON.parse(backupString);
            const unfilteredDiskApis = backupData.apis;
            const diskApis = filter(apiHasValidUrl, unfilteredDiskApis);
            const badDiskApis = filter(api => !apiHasValidUrl(api), unfilteredDiskApis);
            const diskPlugins = backupData.plugins;
            const diskConsumers = backupData.consumers;

            // report APIs that are missing an upstream url
            if (badDiskApis.length > 0) {
              console.log('The following APIs do not have upstream_urls and are filtered out'.red);
              console.log(badDiskApis.map(badApi => badApi.name));
              console.log();
            }

            // from server
            const serverApis = await kong.apis.allApis();
            const serverPlugins = await kong.plugins.allPlugins();
            const serverConsumers = await kong.consumers.allEnrichedConsumers();

            const delay = millis => new Promise(resolve => setTimeout(_ => resolve(), millis));
            const waitTimeInMs = 3000;

            const entityIdComparator = (aEntity, bEntity) => aEntity.id === bEntity.id;
            const entityNameComparator = (aEntity, bEntity) => aEntity.name === bEntity.name;

            // detect and remove Consumers on the server that are not present on disk
            const consumersToDeleteFromServer = differenceWith(entityIdComparator, serverConsumers, diskConsumers);
            const consumerIds = consumersToDeleteFromServer.map(eachConsumer => eachConsumer.id);
            if (consumerIds.length > 0) {
                console.log(JSON.stringify(consumerIds).red);
                consumerIds
                    .map(async id => await kong.consumers.removeConsumerWithCredentials(id)
                        .catch(err => console.log(err.message.grey)));
                console.log('Extra consumers on server have been deleted'.blue);
                await delay(waitTimeInMs);
            }

            // detect and remove Plugins on the server that are not present on disk
            const pluginsToDeleteFromServer = differenceWith(entityIdComparator, serverPlugins, diskPlugins);
            const pluginIds = pluginsToDeleteFromServer.map(eachPlugin => eachPlugin.id);
            if (pluginIds.length > 0) {
                console.log(JSON.stringify(pluginIds).red);
                pluginIds
                    .map(async id => await kong.plugins.removePlugin(id)
                        .catch(err => console.log(err.message.grey)));
                console.log('Extra plugins on server have been deleted'.blue);
                await delay(waitTimeInMs);
            }

            // detect and remove APIs on the server that are not present on disk (based on API name)
            const apisToDeleteFromServer = differenceWith(entityNameComparator, serverApis, diskApis);
            const apiIds = apisToDeleteFromServer.map(eachApi => eachApi.id);
            if (apiIds.length > 0) {
                console.log(JSON.stringify(apiIds).red);
                apiIds.map(async id => await kong.apis.removeApi(id).catch(err => console.log(err.message.grey)));
                console.log('Extra APIs on server have been deleted'.blue);
                await delay(waitTimeInMs);
            }

            // At this point all extra server entities have been removed, now we update all entities from the disk into the server
            console.log('Updating APIs'.bold);
            diskApis.map(async eachApi => await kong.apis.createOrUpdateApi(eachApi));
            console.log('API updates complete'.green);

            await delay(waitTimeInMs);

            console.log('Updating Plugins'.bold);
            diskPlugins.map(async eachPlugin => await kong.plugins.createOrUpdatePlugin(eachPlugin));
            console.log('Plugin updates complete'.green);

            await delay(waitTimeInMs);

            console.log('Updating Consumers and Credentials'.bold);
            if (synchronizeBasicAuthCreds) {
                console.log('WARNING: Synchronizing all consumer credentials including basic authentication');
                diskConsumers.map(async eachConsumer => {
                    await kong.consumers.removeConsumerWithCredentials(eachConsumer.id).catch(err => {
                        console.log(`Could not execute entity request: ${err.options.method} ${err.options.url}`.grey);
                        console.log('Reason: ' + err.error.message.grey);
                    });

                    await delay(500);
                    return await kong.consumers.createOrUpdateConsumerWithCredentials(eachConsumer, synchronizeBasicAuthCreds)
                });
            } else {
                diskConsumers.map(async eachConsumer => {
                    await kong.consumers.cleanConsumerWithCredentials(eachConsumer.id).catch(err => {
                        console.log(`Could not execute entity request: ${err.options.method} ${err.options.url}`.grey);
                        console.log('Reason: ' + err.error.message.grey);
                    });

                    await delay(500);
                    return await kong.consumers.createOrUpdateConsumerWithCredentials(eachConsumer, synchronizeBasicAuthCreds)
                });
            }
            console.log('Consumer and Credentials updates complete'.green);
            console.log('Synchronization process complete'.green.bold);
        } catch (e) {
            console.log(e.message.red);
        } finally {
            console.log(' '.reset);
        }
    });

cli.command('teardown')
    .description('This will wipe all entities of the Kong API Gateway, use with caution!'.red.reset)
    .alias('boom')
    .action(async () => {
        checkValidFlagsAndFailFast(cli.url, cli.username, cli.password);

        try {
            const context = kongContext(cli.username, cli.password, cli.url);
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
    });

cli.parse(process.argv);
