'use strict';

const chai = require('chai');
const expect = chai.expect;
const kongContext = require('../lib/kong/context');
const kongApi = require('../lib/kong/index');
const localKongHost = 'http://127.0.0.1:8001';

describe('Kong API Object Specification', () => {
  it('must be able to create an API', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const apiName = 'example-api-0';
    const uriPath = '/test';
    const upstreamUrl = 'https://www.github.com';
    await kong.apis.createOrUpdateApi({
      name: apiName,
      uris: [uriPath],
      upstream_url: upstreamUrl
    });
    const result = await kong.apis.allApis();
    expect(result).to.have.lengthOf(1);
    const firstResult = result[0];
    expect(firstResult.name).to.equal(apiName);
    expect(firstResult.uris).to.have.lengthOf(1);
    expect(firstResult.uris[0]).to.equal(uriPath);
    expect(firstResult.upstream_url).to.equal(upstreamUrl);
  });

  it('must be able to remove a created API', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const apiName = 'example-api-1';
    const uriPath = '/test';
    const upstreamUrl = 'https://www.github.com';
    await kong.apis.createOrUpdateApi({
      name: apiName,
      uris: [uriPath],
      upstream_url: upstreamUrl
    });
    const result = await kong.apis.allApis();
    expect(result).to.have.lengthOf(1);
    await kong.apis.removeApi(apiName);
    const updatedResult = await kong.apis.allApis();
    expect(updatedResult).to.be.empty;
  });

  it('must be able to list all created APIs', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const apiNameA = 'example-api-1a';
    const uriPathA = '/test';
    const upstreamUrlA = 'https://www.github.com';
    await kong.apis.createOrUpdateApi({
      name: apiNameA,
      uris: [uriPathA],
      upstream_url: upstreamUrlA
    });

    const apiNameB = 'example-api-1b';
    const uriPathB = '/test';
    const upstreamUrlB = 'https://www.github.com';
    await kong.apis.createOrUpdateApi({
      name: apiNameB,
      uris: [uriPathB],
      upstream_url: upstreamUrlB
    });

    const apiNameC = 'example-api-1c';
    const uriPathC = '/test';
    const upstreamUrlC = 'https://www.github.com';
    await kong.apis.createOrUpdateApi({
      name: apiNameC,
      uris: [uriPathC],
      upstream_url: upstreamUrlC
    });

    const batchSize = 1;
    const results = await kong.apis.allApis(batchSize);
    const sortedApiNames = results.map(api => api.name).sort();
    expect(sortedApiNames).to.be.eql([apiNameA, apiNameB, apiNameC]);
  });

  afterEach(async () => {
    // clean up all entities
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const apis = await kong.apis.allApis();
    const apiNames = apis.map(eachApi => eachApi.name);
    apiNames.map(async name => await kong.apis.removeApi(name).catch(err => console.log(err.message)));
  });
});
