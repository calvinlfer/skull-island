"use strict";
const {prop, merge} = require('ramda');

module.exports = function kongApis(connectionContext) {
    const {retrievalAdminRequest, createOrUpdateAdminRequest, deleteAdminRequest} = connectionContext;

    function apis(batchSize = 10) {
        return retrievalAdminRequest('apis', {qs: {size: batchSize}}).then(prop('data'));
    }

    function api(apiNameOrId) {
        return retrievalAdminRequest(`apis/${apiNameOrId}`);
    }

    async function createOrUpdateApi(apiData) {
        async function updateApi(apiData) {
            // if a user manually edits the configuration JSON and does not provide an ID, then attempt
            // a synchronization by looking at the server and obtaining the APIs ID from there
            if (!apiData.id) {
              const apiDataFromServer = await api(apiData.name).catch(_ => undefined);
              // the API does not even exist on the server
              if (!apiDataFromServer) {
                return createOrUpdateAdminRequest('apis', apiData);
              } else {
                // the API exists on the server, inject the id and created_at (mandatory) fields into the disk API data
                const updatedApiData = merge(
                  {'id': apiDataFromServer.id, 'created_at': apiDataFromServer.created_at},
                  apiData
                );
                return createOrUpdateAdminRequest('apis', updatedApiData);
              }
            } else {
              return createOrUpdateAdminRequest('apis', apiData);
            }
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
