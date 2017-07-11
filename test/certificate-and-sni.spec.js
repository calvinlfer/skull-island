'use strict';

const chai = require('chai');
const expect = chai.expect;
const kongContext = require('../lib/kong/context');
const kongApi = require('../lib/kong/index');
const localKongHost = 'http://127.0.0.1:8001';

describe('Kong Certificate and SNI Object Specification', () => {
  it('must be able to create a certificate and list all certificates', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const certificateId = '21b69eab-09d9-40f9-a55e-c4ee47fada68';
    const pubKey = "public-key";
    const privKey = "private-key";
    await kong.certificates.createOrUpdateCertificate({
      id: certificateId,
      cert: pubKey,
      key: privKey
    });
    const result = await kong.certificates.allCertificates();
    expect(result).to.be.lengthOf(1);
    const certificate = result[0];
    expect(certificate.id).to.equal(certificateId);
    expect(certificate.cert).to.equal(pubKey);
    expect(certificate.key).to.equal(privKey);
  });

  it('must be able to remove a created certificate', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const certificateId = '21b69eab-09d9-40f9-a55e-c4ee47fada68';
    const pubKey = "public-key";
    const privKey = "private-key";
    await kong.certificates.createOrUpdateCertificate({
      id: certificateId,
      cert: pubKey,
      key: privKey
    });
    await kong.certificates.removeCertificate(certificateId);
    const result = await kong.certificates.allCertificates();
    expect(result).to.be.empty;
  });

  it('must be able to create SNIs for an existing certificate, look them up and then remove them', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const certificateId = '31b69eab-09d9-40f9-a55e-c4ee47fada69';
    const pubKey = "public-key";
    const privKey = "private-key";
    await kong.certificates.createOrUpdateCertificate({
      id: certificateId,
      cert: pubKey,
      key: privKey
    });
    const sniNameA = "www.example.com";
    const sniNameB = "www.web.com";

    // SNI references the existing certificate
    await kong.snis.createOrUpdateSNI({
      name: sniNameA,
      ssl_certificate_id: certificateId
    });

    await kong.snis.createOrUpdateSNI({
      name: sniNameB,
      ssl_certificate_id: certificateId
    });

    const results = await kong.snis.allSNIs();
    expect(results).to.be.lengthOf(2);
    const sortedResults = results.sort();
    const sniNames = sortedResults.map(sni => sni.name);
    expect(sniNames.sort()).to.eql([sniNameA, sniNameB].sort());
    sortedResults.forEach(sni => expect(sni.ssl_certificate_id).to.be.equal(certificateId));
  });

  afterEach(async () => {
    // clean up all test-related entities
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const snis = await kong.snis.allSNIs();
    const sniNames = snis.map(sni => sni.name);
    sniNames.map(async name => await kong.snis.removeSNI(name));
    const certificates = await kong.certificates.allCertificates();
    const certificateIds = certificates.map(eachCertificate => eachCertificate.id);
    certificateIds.map(async id => await kong.certificates.removeCertificate(id).catch(err => console.log(err.message)));
  });
});
