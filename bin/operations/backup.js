'use strict';
const fs = require('fs');
const {dissoc, merge, compose} = require('ramda');
const colors = require('colors');
const kongContext = require('../../kong/context');
const kongApi = require('../../kong/index');

module.exports = async function backup(filename, url, username, password) {
  let adjustedFileName = 'kong-backup.json';
  if (filename) {
    adjustedFileName = filename;
  }

  try {
    const context = kongContext(username, password, url);
    const kong = kongApi(context);
    const apis = await kong.apis.allApis();
    const plugins = await kong.plugins.allPlugins();
    const consumers = await kong.consumers.allEnrichedConsumers();
    const certificates = await kong.certificates.allCertificates();
    const certificatesWithoutSNIs = certificates.map(certificate => dissoc('snis', certificate));
    const snis = await kong.snis.allSNIs();

    // create certificates directory if it doesn't already exist
    if (!fs.existsSync('certificates')) {
      fs.mkdirSync('certificates');
    }

    // write certificate key-pairs to file and replace the data with the file-paths on the JSON object
    const modifiedCertificates = certificatesWithoutSNIs.map(certificate => {
      const publicKey = certificate.cert;
      const privateKey = certificate.key;
      const id = certificate.id;
      const publicKeyFilePath = `certificates/${id}.pub.pem`;
      const privateKeyFilePath = `certificates/${id}.pem`;
      fs.writeFileSync(publicKeyFilePath, publicKey);
      fs.writeFileSync(privateKeyFilePath, privateKey);
      const certificateMinusCertAndKey = compose(dissoc('cert'), dissoc('key'))(certificate);
      return merge(certificateMinusCertAndKey, { cert_path: publicKeyFilePath, key_path: privateKeyFilePath });
    });

    const results = {
      apis,
      plugins,
      consumers,
      certificates: modifiedCertificates,
      snis
    };

    // TODO: implement the backup process for SNIs

    fs.writeFileSync(adjustedFileName, JSON.stringify(results, null, 4));
    console.log(`Backup data has been written to ${adjustedFileName}`.green)
  } catch (e) {
    console.log(e.message.red)
  } finally {
    console.log(' '.reset);
  }
};
