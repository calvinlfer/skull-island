'use strict';

const {prop, merge} = require('ramda');

module.exports = function kongSNIs(connectionContext) {
  const {retrievalAdminRequest, createOrUpdateAdminRequest, deleteAdminRequest} = connectionContext;

  function snis(batchSize = 10) {
    return retrievalAdminRequest('snis', {qs: {size: batchSize}}).then(prop('data'))
  }

  function sni(name) {
    return retrievalAdminRequest(`snis/${name}`).then(prop('data'));
  }

  async function createOrUpdateSNI(sniData) {
    const millis = (new Date).getTime();
    const sniDataWithTime = merge({created_at: millis}, sniData);
    let response = await createOrUpdateAdminRequest('snis', sniDataWithTime).catch(err => {
      console.log(`Error creating SNI: ${sniData.name} (most likely because it already exists)`, err.data.message);
      return undefined;
    });
    const search = await sni(sniDataWithTime.name).catch(() => undefined);
    // PUT on a non-existent SNI will say everything is fine but really you need
    // to check if the object is present and follow up with a POST if it is not
    if (!search) {
      response = await createOrUpdateAdminRequest('snis', sniDataWithTime, { method: 'POST' });
    }
    return response;
  }

  function removeSNI(name) {
    return deleteAdminRequest('snis', name);
  }

  return {
    allSNIs: snis,
    removeSNI,
    createOrUpdateSNI
  };
};
