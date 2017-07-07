'use strict';
const kongApis = require('./entities/apis');
const kongPlugins = require('./entities/plugins');
const kongConsumers = require('./entities/consumers');
const kongCertificates = require('./entities/certificates');

module.exports = function kong(connectionContext) {
    const {allApis, createOrUpdateApi, removeApi} = kongApis(connectionContext);
    const {plugin, plugins, createOrUpdatePlugin, removePlugin} = kongPlugins(connectionContext);
    const {consumers, consumerDetails, consumersWithAuthentication, createOrUpdateConsumerWithCredentials,
        removeConsumerWithCredentials, cleanConsumerWithCredentials} = kongConsumers(connectionContext);
    const {allCertificates, createOrUpdateCertificate, removeCertificate} = kongCertificates(connectionContext);

    return {
        apis: {
            allApis,
            createOrUpdateApi,
            removeApi
        },
        plugins: {
            pluginsForApi: plugin,
            allPlugins: plugins,
            createOrUpdatePlugin,
            removePlugin
        },
        consumers: {
            allConsumers: consumers,
            consumerDetails: consumerDetails,
            allEnrichedConsumers: consumersWithAuthentication,
            createOrUpdateConsumerWithCredentials,
            removeConsumerWithCredentials,
            cleanConsumerWithCredentials
        },
        certificates: {
          allCertificates,
          createOrUpdateCertificate,
          removeCertificate
        }
    };
};
