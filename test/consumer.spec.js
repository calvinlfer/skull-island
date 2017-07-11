'use strict';

const chai = require('chai');
const expect = chai.expect;
const kongContext = require('../lib/kong/context');
const kongApi = require('../lib/kong/index');
const localKongHost = 'http://127.0.0.1:8001';
const delay = millis => new Promise(resolve => setTimeout(() => resolve(), millis));
const DelayTime = 100;

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
    await delay(DelayTime);

    const result = await kong.consumers.consumerDetails(consumerId, 'key-auth');
    const keyAuth = result[0];
    expect(result).to.be.lengthOf(1);
    expect(keyAuth.consumer_id).to.be.equal(consumerId);
    expect(keyAuth.key).to.be.equal(apiKey);
  });

  it('must be able to remove a consumer and its credentials (without touching basic authentication)', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const consumerUsername = 'calvin-consumer-3';
    const consumerId = "55017133-d70c-4659-bb91-ad23d5c81165";
    const apiKey = '8544031257b140debd2b9aef089283f5';
    const synchronizeBasicAuth = true;
    await kong.consumers.createOrUpdateConsumerWithCredentials({
      credentials: {
        "key-auth": [
          {
            created_at: 1499722969000,
            consumer_id: consumerId,
            key: apiKey
          }
        ],
        "basic-auth": [
          {
            password: "a-random-password",
            consumer_id: consumerId,
            username: "cal",
            created_at: 1499286562000
          }
        ]
      },
      username: consumerUsername,
      id: consumerId,
      created_at: 1499722718000
    }, synchronizeBasicAuth);

    // Kong doesn't process this instantly so we wait
    await delay(DelayTime);
    await kong.consumers.cleanConsumerWithCredentials(consumerId);

    // Kong doesn't process this instantly so we wait
    await delay(DelayTime);

    const result = await kong.consumers.allEnrichedConsumers();
    expect(result).to.be.lengthOf(1);
    const firstResult = result[0];
    expect(firstResult.credentials['key-auth']).to.be.lengthOf(0);
    expect(firstResult.credentials['basic-auth']).to.be.lengthOf(1);
    const basicAuth = firstResult.credentials['basic-auth'][0];
    expect(basicAuth.username).to.be.equal('cal');
    expect(basicAuth.consumer_id).to.be.equal(consumerId);
  });

  it('must be able to completely remove a consumer', async () => {
    const context = kongContext('', '', localKongHost);
    const kong = kongApi(context);
    const consumerUsername = 'calvin-consumer-4';
    const consumerId = "65017133-d70c-4659-bb91-ad23d5c81167";
    const apiKey = '8544031257b140debd2b9aef089283f5';
    const synchronizeBasicAuth = true;
    await kong.consumers.createOrUpdateConsumerWithCredentials({
      credentials: {
        "key-auth": [
          {
            created_at: 1499722969000,
            consumer_id: consumerId,
            key: apiKey
          }
        ],
        "basic-auth": [
          {
            password: "a-random-password",
            consumer_id: consumerId,
            username: "cal",
            created_at: 1499286562000
          }
        ]
      },
      username: consumerUsername,
      id: consumerId,
      created_at: 1499722718000
    }, synchronizeBasicAuth);

    // Kong doesn't process this instantly so we wait
    await delay(DelayTime);
    await kong.consumers.removeConsumerWithCredentials(consumerId);

    // Kong doesn't process this instantly so we wait
    await delay(DelayTime);

    const result = await kong.consumers.allEnrichedConsumers();
    expect(result).to.be.lengthOf(0);
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
