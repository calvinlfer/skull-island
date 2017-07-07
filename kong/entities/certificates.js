"use strict";

const {dissoc, prop, merge} = require('ramda');

module.exports = function kongCertificates(connectionContext) {
  const {retrievalAdminRequest, createOrUpdateAdminRequest, deleteAdminRequest} = connectionContext;

  function certificates(batchSize = 10) {
    return retrievalAdminRequest('certificates', {qs: {size: batchSize}}).then(prop('data'));
  }

  async function createOrUpdateCertificate(certData) {
    async function updateCertificate(certificateData) {
      let updatedCertificateData = certificateData;
      if (!certificateData.created_at) {
        // add a created_at time if the user has not specified one
        const millis = (new Date).getTime();
        updatedCertificateData = merge({created_at: millis}, certificateData);
      }

      return createOrUpdateAdminRequest('certificates', updatedCertificateData);
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
