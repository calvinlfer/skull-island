#!/usr/bin/env node

'use strict';

const fs = require('fs');
const cli = require('commander');
const colors = require('colors');
const {version} = require('../package.json');
const backup = require('./operations/backup');
const teardown = require('./operations/teardown');
const synchronization = require('./operations/synchronization');

function checkValidFlagsAndFailFast(url, username, password) {
    if (!url) {
        console.log('Please specify the url (eg. -l http://127.0.0.1:8001)'.yellow);
        process.exit(1);
    }

    if (username && !password) {
        console.log('Please specify both the username (-u) and the password (-p) to enable Basic Authentication'.yellow);
        process.exit(2);
    }
}

cli.version(version)
    .option('-u, --username <user>', 'Kong Admin API Username (optional)')
    .option('-p, --password <pass>', 'Kong Admin API Password (optional unless username is specified)')
    .option('-l, --url <url>', 'Kong Admin API URL (eg. http://127.0.0.1:8001)')
    .option('-b --synch-basic-auth-creds', 'Tell the synchronization process to upload basic authentication data ' +
        '(WARNING: passwords must be in plaintext and this is disabled by default). '.red +
        'Do not dump your basic-authentication configuration and attempt to synchronize it, your credentials will stop working. '.bold +
        'You have been warned'.reset
    );

cli.command('backup [filename]')
    .description(
        'Creates a backup configuration of APIs, Plugins, Consumers and Consumer Credentials from the provided Kong API ' +
        'Gateway URL, you can specify the filename where the backup will materialize (defaults to kong-backup.json)'
    )
    .alias('bk')
    .action(filename => {
        checkValidFlagsAndFailFast(cli.url, cli.username, cli.password);
        backup(filename, cli.url, cli.username, cli.password);
    });

cli.command('synchronize [filename]')
    .description(
        'Synchronizes the configuration file (defaults to kong-backup.json) on disk with the configuration on the ' +
        'server. It will remove server entities that are not present in the configuration file and will update the rest ' +
        'of the entities. The default filename is kong-backup.json'
    )
    .alias('sync')
    .action(filename => {
        checkValidFlagsAndFailFast(cli.url, cli.username, cli.password);
        synchronization(filename, cli.url, cli.username, cli.password, cli.synchBasicAuthCreds);
    });

cli.command('teardown')
    .description('This will wipe all entities of the Kong API Gateway, use with caution!'.red.reset)
    .alias('boom')
    .action(() => {
        checkValidFlagsAndFailFast(cli.url, cli.username, cli.password);
        teardown(cli.url, cli.username, cli.password);
    });

cli.parse(process.argv);
