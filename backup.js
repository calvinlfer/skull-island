"use strict";
const fs = require('fs');
const kongApi = require('./kong');

const username = "cfernandes";
const password = "cfernandescfernandescfernandes";
const adminUrl = "https://ci-kong.api.loyalty.com/kong";

async function backupProgram() {
    const kong = kongApi(username, password, adminUrl);
    const apis = await kong.apis.allApis();
    const plugins = await kong.plugins.allPlugins();
    const consumers = await kong.consumers.allEnrichedConsumers();
    const results = { apis, plugins, consumers };
    fs.writeFileSync("example.json", JSON.stringify(results, null, 4));
}

backupProgram();
