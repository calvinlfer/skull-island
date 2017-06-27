'use strict';
const {prop, merge, mergeAll, mergeDeepLeft, assoc, dissoc, has, pickBy, keys, filter} = require('ramda');

module.exports = function kong(connectionContext) {
    const {retrievalAdminRequest, createOrUpdateAdminRequest, deleteAdminRequest} = connectionContext;

    function apiAndPluginEnrichment(response) {
        const futureEnrichedCombinedData = Promise.all(
            response.data.map(eachApiResponse =>
                plugin(eachApiResponse.id).then(pluginData => merge(eachApiResponse, {plugins: pluginData}))
            )
        );
        return futureEnrichedCombinedData.then(enrichedCombinedData => merge(response, {data: enrichedCombinedData}))
    }

    function consumerWithAuthenticationEnrichment(response) {
        const authPlugins = ['jwt', 'basic-auth', 'oauth2', 'key-auth', 'hmac-auth', 'acls'];
        const futureEnrichedConsumers = Promise.all(
            response.data.map(eachConsumer => {
                const futureAllTopicsForConsumer = Promise.all(
                    authPlugins.map(eachTopic =>
                        consumerDetails(eachConsumer.id, eachTopic)
                            .catch(_ => [])
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

    function plugin(apiId) {
        const configuration = {qs: {api_id: apiId}};
        return retrievalAdminRequest('plugins', configuration).then(prop('data'));
    }

    function plugins(batchSize = 10) {
        return retrievalAdminRequest('plugins', {qs: {size: batchSize}}).then(prop('data'));
    }

    async function createOrUpdatePlugin(pluginData) {
        function updatePlugin(pluginPath, pluginData) {
            return createOrUpdateAdminRequest(pluginPath, pluginData);
        }

        function createPlugin(pluginPath, pluginData) {
            return createOrUpdateAdminRequest(pluginPath, pluginData, {method: 'POST'});
        }

        const hasApiId = has('api_id');

        // check if this is a global plugin or a it's for a certain API
        if (hasApiId(pluginData)) {
            const pluginPath = `apis/${pluginData.api_id}/plugins`;
            const result = await updatePlugin(pluginPath, pluginData);
            if (!result) {
                return createPlugin(pluginPath, pluginData);
            } else return result;
        } else {
            // global plugin
            const pluginPath = `plugins`;
            const result = await updatePlugin(pluginPath, pluginData);
            if (!result) {
                return createPlugin(pluginPath, pluginData);
            } else return result;
        }
    }

    function removePlugin(pluginId) {
        return deleteAdminRequest('plugins', pluginId);
    }

    function apis(batchSize = 10) {
        return retrievalAdminRequest('apis', {qs: {size: batchSize},}).then(prop('data'));
    }

    async function createOrUpdateApi(apiData) {
        function updateApi(apiData) {
            return createOrUpdateAdminRequest('apis', apiData);
        }

        function createApi(apiData) {
            return createOrUpdateAdminRequest('apis', apiData, {method: 'POST'});
        }

        const result = await updateApi(apiData);
        if (!result) {
            return createApi(apiData);
        } else {
            return result;
        }
    }

    function removeApi(apiNameOrId) {
        return deleteAdminRequest('apis', apiNameOrId);
    }

    function apisWithPlugins(batchSize = 10) {
        return retrievalAdminRequest('apis', {qs: {size: batchSize}}, null)
            .then(apiAndPluginEnrichment)
            .then(prop('data'));
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

            return credentialDataList.map(async credentialData => {
                const consumerId = credentialData.consumer_id;
                const result = await updateConsumerCredential(consumerId, credentialData);
                if (!result) {
                    return await createConsumerCredential(consumerId, credentialData);
                } else {
                    return result;
                }
            });
        }

        const criteria = (value, key) => value.length > 0;
        const credentialPlugins = consumerDataWithCredentials.credentials;
        let filteredCredentialPlugins = pickBy(criteria, credentialPlugins);

        if (uploadBasicAuthenticationCredentials) {
            console.log(`WARNING: Synchronizing basic-auth consumer credentials for consumer: (${consumerDataWithCredentials.username}, ${consumerDataWithCredentials.id})`);
            filteredCredentialPlugins = filter(
                credentialPlugin => credentialPlugin.key !== 'basic-auth',
                filteredCredentialPlugins
            )
        }

        const consumerData = dissoc('credentials', consumerDataWithCredentials);

        await createOrUpdateConsumer(consumerData);

        keys(filteredCredentialPlugins).map(async key =>
            await createOrUpdateConsumerCredential(key, filteredCredentialPlugins[key])
        );
    }

    function removeConsumerWithCredentials(consumerNameOrId) {
        return deleteAdminRequest('consumers', consumerNameOrId)
    }

    return {
        apis: {
            allApis: apis,
            allEnrichedApis: apisWithPlugins,
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
            removeConsumerWithCredentials
        }
    };
};