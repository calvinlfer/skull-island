"use strict";
const fs = require('fs');
const {promisify} = require('util');
const readFile = promisify(fs.readFile);
const kongApi = require('./kong');

const username = "example";
const password = "example";
const adminUrl = "http://localhost:8001";

async function uploadProgram() {
    const kong = kongApi(username, password, adminUrl);
    const backupString = await readFile('example.json', {encoding: 'utf8'});
    const backupData = JSON.parse(backupString);
    const apis = backupData.apis;
    // Create APIs
    // apis.map(async eachApi => await kong.apis.createOrUpdateApi(eachApi));

    // Remove all APIs
    // const apiNames = apis.map(eachApi => eachApi.name);
    // apiNames.map(async name => await kong.apis.removeApi(name));
}

uploadProgram();
