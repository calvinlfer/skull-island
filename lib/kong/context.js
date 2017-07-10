'use strict';

const request = require('request-promise-native');
const {merge, mergeDeepLeft, compose} = require('ramda');

module.exports = function connectionContext(username, password, adminUrl) {
    const authentication = "Basic " + new Buffer(username + ":" + password).toString("base64");
    const baseConfiguration = {
        headers: {"Authorization": authentication},
        json: true
    };

    function retrievalAdminRequest(resource, additionalConfiguration = {}, offset = null) {
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
                    return retrievalAdminRequest(resource, additionalConfiguration, result.offset)
                        .then(nextResult => standardKongResponseSemigroup(result, nextResult));
                } else {
                    return result;
                }
            });
    }

    function createOrUpdateAdminRequest(resource, body, additionalConfiguration = {}) {
        const configuration = compose(
            mergeDeepLeft(baseConfiguration),
            mergeDeepLeft(additionalConfiguration)
        )({url: `${adminUrl}/${resource}`, method: 'PUT', body});
        return request(configuration);
    }

    function deleteAdminRequest(resource, entityNameOrId) {
        const configuration = mergeDeepLeft(
            baseConfiguration, {url: `${adminUrl}/${resource}/${entityNameOrId}`, method: 'DELETE'}
        );
        return request(configuration);
    }

    return {
        retrievalAdminRequest,
        createOrUpdateAdminRequest,
        deleteAdminRequest
    };
};
