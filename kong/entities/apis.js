"use strict";
const {prop} = require('ramda');

module.exports = function kongApis(connectionContext) {
    const {retrievalAdminRequest, createOrUpdateAdminRequest, deleteAdminRequest} = connectionContext;

    function apis(batchSize = 10) {
        return retrievalAdminRequest('apis', {qs: {size: batchSize}}).then(prop('data'));
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

    return {
        allApis: apis,
        createOrUpdateApi,
        removeApi
    }
};
