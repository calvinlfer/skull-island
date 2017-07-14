'use strict';

const {prop, merge, mergeAll, mergeDeepLeft, assoc, dissoc, pickBy, keys, reduce} = require('ramda');

module.exports = function kongConsumers(connectionContext) {
    const {retrievalAdminRequest, createOrUpdateAdminRequest, deleteAdminRequest} = connectionContext;
    const authPlugins = ['jwt', 'basic-auth', 'oauth2', 'key-auth', 'hmac-auth', 'acls'];

    function consumerWithAuthenticationEnrichment(response) {
        const futureEnrichedConsumers = Promise.all(
            response.data.map(eachConsumer => {
                const futureAllTopicsForConsumer = Promise.all(
                    authPlugins.map(eachTopic =>
                        consumerDetails(eachConsumer.id, eachTopic)
                            .catch(() => [])
                            .then(eachTopicData => assoc(eachTopic, eachTopicData, {}))
                    )
                );

                return futureAllTopicsForConsumer.then(allTopicsForConsumer =>
                    assoc('credentials', allTopicsForConsumer, eachConsumer)
                );
            })
        );

        return futureEnrichedConsumers.then(enrichedData =>
            merge(response, { data: enrichedData })
        );
    }

    function consumers(batchSize = 10) {
        return retrievalAdminRequest('consumers', {qs: {size: batchSize}}).then(prop('data'));
    }

    function consumersWithAuthentication(batchSize = 10) {
        function flattenCredentialStructure(enrichedConsumer) {
            const aggregatedCredentials = mergeAll(enrichedConsumer.credentials);
            return mergeDeepLeft({ credentials: aggregatedCredentials }, dissoc('credentials', enrichedConsumer))
        }

        return retrievalAdminRequest('consumers', {qs: {size: batchSize}}, null)
            .then(consumerWithAuthenticationEnrichment)
            .then(prop('data'))
            .then(enrichedConsumers => enrichedConsumers.map(flattenCredentialStructure));
    }

    function consumerDetails(consumerId, topic) {
        return retrievalAdminRequest(`consumers/${consumerId}/${topic}`).then(prop('data'));
    }

    async function createOrUpdateConsumerWithCredentials(consumerDataWithCredentials, uploadBasicAuthenticationCredentials = false) {
        async function createOrUpdateConsumer(consumerData) {
            function updateConsumer(consumerData) {
                return createOrUpdateAdminRequest('consumers', consumerData);
            }

            function createConsumer(consumerData) {
                return createOrUpdateAdminRequest('consumers', consumerData, {method: 'POST'});
            }

            const result = await updateConsumer(consumerData);
            if (!result) {
                return await createConsumer(consumerData);
            } else {
                return result;
            }
        }

        async function createOrUpdateConsumerCredential(credentialType, credentialDataList) {
            function updateConsumerCredential(consumerId, consumerData) {
                return createOrUpdateAdminRequest(`consumers/${consumerId}/${credentialType}`, consumerData);
            }

            function createConsumerCredential(consumerId, consumerData) {
                return createOrUpdateAdminRequest(`consumers/${consumerId}/${credentialType}`, consumerData, {method: 'POST'});
            }

            return Promise.all(
              credentialDataList.map(async credentialData => {
                const consumerId = credentialData.consumer_id;
                const result = await updateConsumerCredential(consumerId, credentialData);
                if (!result) {
                  return await createConsumerCredential(consumerId, credentialData);
                } else {
                  return result;
                }
              })
            );
        }

        const criteria = value => value.length > 0;
        const credentialPlugins = consumerDataWithCredentials.credentials;
        let filteredCredentialPlugins = pickBy(criteria, credentialPlugins);

        if (!uploadBasicAuthenticationCredentials) {
            filteredCredentialPlugins = dissoc('basic-auth', filteredCredentialPlugins);
        } else {
            console.log(`WARNING: Synchronizing basic-auth consumer credentials for consumer: (${consumerDataWithCredentials.username}, ${consumerDataWithCredentials.id})`);
        }

        const consumerData = dissoc('credentials', consumerDataWithCredentials);

        await createOrUpdateConsumer(consumerData);

        return await Promise.all(
          keys(filteredCredentialPlugins).map(async key => await createOrUpdateConsumerCredential(key, filteredCredentialPlugins[key]))
        );
    }

    function removeConsumerWithCredentials(consumerNameOrId) {
        return deleteAdminRequest('consumers', consumerNameOrId)
    }

    // Removes all consumer credentials except basic-auth
    async function cleanConsumerWithCredentials(consumerNameOrId) {
        const plugins = await reduce(async (acc, nextPlugin) => {
            const pluginData = await consumerDetails(consumerNameOrId, nextPlugin);
            const pluginObject = assoc(nextPlugin, pluginData, {});
            // async-await functions return promises, so the acc from the previous round is in a Promise context
            return mergeDeepLeft(pluginObject, await acc);
        }, {}, authPlugins);

        const pluginsDataWithoutBasicAuth = dissoc('basic-auth', plugins);
        return authPlugins
            .filter(pluginName => pluginName !== 'basic-auth')
            .filter(pluginName => pluginsDataWithoutBasicAuth[pluginName].length > 0)
            .map(pluginName => {
                const credentialList = pluginsDataWithoutBasicAuth[pluginName];
                return {pluginName, credentialList};
            })
            .map(({pluginName, credentialList}) =>
                Promise.all(
                  credentialList.map(async credential => await deleteAdminRequest(`consumers/${consumerNameOrId}/${pluginName}`, credential.id))
                )
            );
    }

    return {
        consumers,
        consumerDetails,
        consumersWithAuthentication,
        createOrUpdateConsumerWithCredentials,
        removeConsumerWithCredentials,
        cleanConsumerWithCredentials
    };
};
