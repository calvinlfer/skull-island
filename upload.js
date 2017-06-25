"use strict";
const fs = require('fs');
const {promisify} = require('util');
const readFile = promisify(fs.readFile);
const kongApi = require('./kong');

const username = "example";
const password = "example";
const adminUrl = "http://localhost:8001";

const delay = millis => new Promise(resolve => setTimeout(_ => resolve(), millis));

async function uploadProgram() {
    const kong = kongApi(username, password, adminUrl);
    const backupString = await readFile('example.json', {encoding: 'utf8'});
    const backupData = JSON.parse(backupString);
    const apis = backupData.apis;
    const plugins = backupData.plugins;

    // Create APIs
    apis.map(async eachApi => await kong.apis.createOrUpdateApi(eachApi));
    console.log('API creation complete');

    // Remove all APIs
    // const apiNames = apis.map(eachApi => eachApi.name);
    // apiNames.map(async name => await kong.apis.removeApi(name).catch(err => console.log(err.message)));
    // console.log('API deletion complete');

    await delay(5000);

    // Create Plugins
    plugins.map(async eachPlugin => await kong.plugins.createOrUpdatePlugin(eachPlugin));
    console.log('Plugin creation complete');

    // Remove Plugins
    // const pluginIds = plugins.map(eachPlugin => eachPlugin.id);
    // pluginIds.map(async id => await kong.plugins.removePlugin(id).catch(err => console.log(err.message)));
    // console.log('Plugin deletion complete');
}

uploadProgram();
