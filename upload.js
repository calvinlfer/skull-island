"use strict";
const fs = require('fs');
const {promisify} = require('util');
const {dissoc} = require('ramda');
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
    const apisWithoutPlugins = apis.map(dissoc('plugins'));
    // add all APIs without their plugins
    apisWithoutPlugins.map(async eachApi => await kong.apis.createOrUpdateApi(eachApi));

}

uploadProgram();
