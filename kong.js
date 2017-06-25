'use strict';

const fs = require('fs');
const request = require('request-promise-native');
const {prop, merge, mergeDeepLeft, compose, assoc} = require('ramda');

module.exports = function kong(username, password, adminUrl) {
    const authentication = "Basic " + new Buffer(username + ":" + password).toString("base64");
    const baseConfiguration = {
        headers: {"Authorization": authentication},
        json: true
    };

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

    function adminApi(resource, additionalConfiguration = {}, offset = null) {
        function standardKongResponseSemigroup(responseA, responseB) {
            const combinedData = responseA.data.concat(responseB.data);
            return merge(responseB, {data: combinedData});
        }

        function retrieveData(nextOffset) {
            const configuration = compose(
                mergeDeepLeft(additionalConfiguration),
                mergeDeepLeft(baseConfiguration)
            )({url: `${adminUrl}/${resource}`});

            if (!nextOffset) {
                return request(configuration)
            } else {
                const updatedConfiguration = mergeDeepLeft(configuration, {qs: {offset: nextOffset}});
                return request(updatedConfiguration)
            }
        }

        return retrieveData(offset)
            .then(result => {
                if (result.next) {
                    return adminApi(resource, additionalConfiguration, result.offset)
                        .then(nextResult => standardKongResponseSemigroup(result, nextResult));
                } else {
                    return result;
                }
            });
    }

    function plugin(apiId) {
        const configuration = {qs: {api_id: apiId}};
        return adminApi('plugins', configuration).then(prop('data'));
    }

    function plugins(batchSize = 10) {
        return adminApi('plugins', {qs: {size: batchSize}}).then(prop('data'));
    }

    function apis(batchSize = 10) {
        return adminApi('apis', {qs: {size: batchSize},}).then(prop('data'));
    }

    function apisWithPlugins(batchSize = 10) {
        return adminApi('apis', {qs: {size: batchSize}}, null)
            .then(apiAndPluginEnrichment)
            .then(prop('data'));
    }

    function consumers(batchSize = 10) {
        return adminApi('consumers', {qs: {size: batchSize}}).then(prop('data'));
    }

    function consumersWithAuthentication(batchSize = 10) {
        return adminApi('consumers', {qs: {size: batchSize}}, null)
            .then(consumerWithAuthenticationEnrichment)
            .then(prop('data'));
    }

    function consumerDetails(consumerId, topic) {
        return adminApi(`consumers/${consumerId}/${topic}`).then(prop('data'));
    }

    return {
        pluginsForApi: plugin,
        allPlugins: plugins,
        allApis: apis,
        allEnrichedApis: apisWithPlugins,
        allConsumers: consumers,
        consumerDetails: consumerDetails,
        allEnrichedConsumers: consumersWithAuthentication,
        admin: adminApi
    };
};