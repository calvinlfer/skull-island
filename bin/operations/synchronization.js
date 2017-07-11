'use strict';
const fs = require('fs');
const colors = require('colors');
const {promisify} = require('util');
const readFile = promisify(fs.readFile);
const {differenceWith, filter}= require('ramda');
const kongContext = require('../../lib/kong/context');
const kongApi = require('../../lib/kong/index');

module.exports = async function synchronization(filename, url, username, password, synchBasicAuthCreds) {
  function apiHasValidUrl(apiObject) {
    return apiObject.upstream_url.startsWith('http');
  }

  let adjustedFileName = 'kong-backup.json';
  if (filename) {
    adjustedFileName = filename;
  }

  try {
    const context = kongContext(username, password, url);
    const kong = kongApi(context);

    // from disk
    const backupString = await readFile(adjustedFileName, {encoding: 'utf8'});
    const backupData = JSON.parse(backupString);
    const unfilteredDiskApis = backupData.apis;
    const diskApis = filter(apiHasValidUrl, unfilteredDiskApis);
    const badDiskApis = filter(api => !apiHasValidUrl(api), unfilteredDiskApis);
    const diskPlugins = backupData.plugins || [];
    const diskConsumers = backupData.consumers || [];
    const diskSNIs = backupData.snis || [];
    const diskCertificates = backupData.certificates || [];

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
    const serverSNIs = await kong.snis.allSNIs();
    const serverCertificates = await kong.certificates.allCertificates();

    const delay = millis => new Promise(resolve => setTimeout(() => resolve(), millis));
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

    // detect and remove SNIs and then certificates on the server that are not present on disk
    const snisToDeleteFromServer = differenceWith(entityNameComparator, serverSNIs, diskSNIs);
    if (snisToDeleteFromServer.length > 0) {
      const sniNames = snisToDeleteFromServer.map(sni => sni.name);
      console.log(JSON.stringify(sniNames).red);
      sniNames.forEach(async name =>
        await kong.snis.removeSNI(name).catch(err => console.log(`error removing SNI (${name})`, err.message.data))
      );
      console.log('Extra SNIs on server have been deleted'.blue);
      await delay(waitTimeInMs);
    }

    const certificatesToDeleteFromServer = differenceWith(entityIdComparator, serverCertificates, diskCertificates);
    if (certificatesToDeleteFromServer.length > 0) {
      const certificateIds = certificatesToDeleteFromServer.map(cert => cert.id);
      console.log(JSON.stringify(certificateIds).red);
      certificateIds.forEach(async id =>
        await kong.certificates.removeCertificate(id).catch(err => console.log(`error removing Certificate (${id})`, err.message.data))
      );
      console.log('Extra Certificates on server have been deleted'.blue);
    }

    // Upload new certificates
    console.log('Updating certificates'.bold);
    const adjustedKongCertificates = diskCertificates.map(async certificate => {
      const certificateId = certificate.id;
      const createdAt = certificate.created_at;
      const privateKeyPath = certificate.key_path;
      const publicKeyPath = certificate.cert_path;
      const privateKey = await readFile(privateKeyPath, {encoding: 'utf8'});
      const publicKey = await readFile(publicKeyPath, {encoding: 'utf8'});
      return {
        id: certificateId,
        created_at: createdAt,
        cert: publicKey,
        key: privateKey
      };
    });
    const kongCertificatesToUpload = await Promise.all(adjustedKongCertificates);
    kongCertificatesToUpload.map(async certificate => await kong.certificates.createOrUpdateCertificate(certificate));
    console.log('Certificate updates complete'.green);

    // Upload new SNIs
    console.log('Updating SNIs'.bold);
    diskSNIs.map(async sni =>
      await kong.snis.createOrUpdateSNI(sni).catch(err => {
        if (err.statusCode !== 409) console.log(`Error adding SNI`, err.message);
      })
    );
    console.log('SNI updates complete'.green);
    await delay(waitTimeInMs);

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
    if (synchBasicAuthCreds) {
      console.log('WARNING: Synchronizing all consumer credentials including basic authentication');
      diskConsumers.map(async eachConsumer => {
        await kong.consumers.removeConsumerWithCredentials(eachConsumer.id).catch(err => {
          console.log(`Could not execute entity request: ${err.options.method} ${err.options.url}`.grey);
          console.log('Reason: ' + err.error.message.grey);
        });

        await delay(500);
        return await kong.consumers.createOrUpdateConsumerWithCredentials(eachConsumer, synchBasicAuthCreds)
      });
    } else {
      diskConsumers.map(async eachConsumer => {
        await kong.consumers.cleanConsumerWithCredentials(eachConsumer.id).catch(err => {
          console.log(`Could not execute entity request: ${err.options.method} ${err.options.url}`.grey);
          console.log('Reason: ' + err.error.message.grey);
        });

        await delay(500);
        return await kong.consumers.createOrUpdateConsumerWithCredentials(eachConsumer, synchBasicAuthCreds)
      });
    }

    console.log('Consumer and Credentials updates complete'.green);
    console.log('Synchronization process complete'.green.bold);
  } catch (e) {
    console.log(e);
    console.log(e.message.red);
  } finally {
    console.log(' '.reset);
  }
};
