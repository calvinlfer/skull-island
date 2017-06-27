'use strict';
const {prop, has} = require('ramda');

module.exports = function kongPlugins(connectionContext) {
    const {retrievalAdminRequest, createOrUpdateAdminRequest, deleteAdminRequest} = connectionContext;

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

    return {
        plugin,
        plugins,
        createOrUpdatePlugin,
        removePlugin
    };
};
