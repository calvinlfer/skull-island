"use strict";

const {dissoc, prop} = require('ramda');

module.exports = function kongCertificates(connectionContext) {
  const {retrievalAdminRequest, createOrUpdateAdminRequest, deleteAdminRequest} = connectionContext;

  function certificates(batchSize = 10) {
    return retrievalAdminRequest('certificates', {qs: {size: batchSize}}).then(prop('data'));
  }

  async function createOrUpdateCertificate(certData) {
    async function updateCertificate(certificateData) {
      return createOrUpdateAdminRequest('certificates', certificateData);
    }

    function createCertificate(certificateData) {
      return createOrUpdateAdminRequest('certificates', certificateData, { method: 'POST' });
    }

    if (certData.snis) {
      console.error('Warning: Ignoring certificate SNIs sugar syntax, use the SNI entities explicitly')
    }

    const certWithoutSNIData = dissoc('snis', certData);
    if (certWithoutSNIData.id) {
      // this is most likely an existing certificate so try to do an update
      const certResponse = await updateCertificate(certWithoutSNIData);
      // this is a brand new Certificate
      if (!certResponse) return createCertificate(certWithoutSNIData);
      else return certResponse

    } else return createCertificate(certWithoutSNIData);

  }

  function removeCertificate(certificateId) {
    return deleteAdminRequest('certificates', certificateId);
  }

  return {
    allCertificates: certificates,
    createOrUpdateCertificate,
    removeCertificate
  }
};
