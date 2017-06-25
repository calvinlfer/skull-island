"use strict";
const fs = require('fs');
const kongApi = require('./kong');

const username = "<insert here>";
const password = "<password>";
const adminUrl = "<kong-admin-url-with-http>";

async function program() {
    const kong = kongApi(username, password, adminUrl);
    const apis = await kong.allEnrichedApis();
    const plugins = await kong.allPlugins();
    const consumers = await kong.allEnrichedConsumers();
    const results = { apis, plugins, consumers };
    fs.writeFileSync("example.json", JSON.stringify(results, null, 4));
}

program();
