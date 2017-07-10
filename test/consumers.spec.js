'use strict';

const chai = require('chai');
const expect = chai.expect;
const kongContext = require('../lib/kong/context');
const kongApi = require('../lib/kong/index');
const localKongHost = 'http://127.0.0.1:8001';
const delay = millis => new Promise(resolve => setTimeout(() => resolve(), millis));

describe('Kong Consumer Object Specification', () => {
  it('must be able to create a consumer and list all consumers', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const username = 'calvin-consumer-1';
    await kong.consumers.createOrUpdateConsumerWithCredentials({username});
    const consumers = await kong.consumers.allConsumers();
    expect(consumers).to.be.lengthOf(1);
    const onlyConsumer = consumers[0];
    expect(onlyConsumer.username).to.be.equal(username);
  });

  it('must be able to create a consumer with key-auth credentials and confirm that it has been created', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const username = 'calvin-consumer-2';
    const consumerId = "45017133-d70c-4659-bb91-ad23d5c81160";
    const apiKey = '0544031257b140debd2b9aef089283fb';
    await kong.consumers.createOrUpdateConsumerWithCredentials({
      credentials: {
        "key-auth": [
          {
            created_at: 1499722969000,
            consumer_id: consumerId,
            key: "0544031257b140debd2b9aef089283fb"
          }
        ],
      },
      username,
      id: consumerId,
      created_at: 1499722718000
    });

    // Kong doesn't process this instantly so we wait
    await delay(500);

    const result = await kong.consumers.consumerDetails(consumerId, 'key-auth');
    const keyAuth = result[0];
    expect(result).to.be.lengthOf(1);
    expect(keyAuth.consumer_id).to.be.equal(consumerId);
    expect(keyAuth.key).to.be.equal(apiKey);
  });

  it('must be able to remove a consumer and its credentials (without touching basic authentication)', () => {

  });

  afterEach(async () => {
    // clean up all test-related entities
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const consumers = await kong.consumers.allConsumers();
    const consumerUsernames = consumers.map(sni => sni.username);
    consumerUsernames.map(async username =>
      await kong.consumers.removeConsumerWithCredentials(username).catch(err => console.log(err.message))
    );
  });
});
