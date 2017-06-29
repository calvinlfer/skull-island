# Skull Island
<img src="https://user-images.githubusercontent.com/14280155/27614840-3549c276-5b72-11e7-97e2-71ea760664d2.png" width=300 />

Skull Island is a declarative configuration management tool for
[Kong API Gateway](https://getkong.org/) to backup and synchronize Kong
API Gateway configuration. We recommend using [Kong Dashboard](https://github.com/PGBI/kong-dashboard)
to add routes through a UI and then using Skull Island to backup the
configuration changes and later synchronize it. Skull Island is inspired by [Kongfig](https://github.com/mybuilder/kongfig) and [Biplane](https://github.com/articulate/biplane).

<h5>
    <span style="color:red">This is a work-in-progress, please use at your own risk</span>
</h5>

## Caveats and Design Decisions
Kong's `basic-auth` consumer credentials currently cannot be backed up
and re-applied because the backup obtains encrypted credentials and
reapplying the encrypted credentials causes the credentials to be
encrypted once more which is incorrect and will cause your credentials
to stop working. As a result, we disable synchronization of basic
authentication consumer credentials by default. There is a flag (`-b`)
which allows you to synchronize basic authentication credentials
provided that you store plaintext credentials in the backup file. The
intended use case for Skull-Island was to be used in conjunction with
[Kong-Dashboard](https://github.com/PGBI/kong-dashboard) in order to
have a better process workflow rather than coming up with your own JSON
configuration.

For the synchronization process, extra entities for APIs, Plugins and
Consumers that are present on the server and are not present on disk are
deleted. For now, all Consumer Credentials (except basic-authentication
unless specified) are removed from the server completely and then
synchronized from disk resulting in slight downtime.

### `upstream_url` for API Entities
As part of the workflow, you might introduce
[`fill-in-the-blanks`](https://github.com/calvinlfer/fill-in-the-blanks),
to minimize duplication for Skull-Island backups especially when you
need to deploy your changes to multiple environments. `upstream_url`
field is a Kong URL required field. if the `kong-backup.json` file has
some endpoints without proper `upstream_url` field then those specific
endpoints will be skipped and the script won't fail during synchronization
process. This decision was taken because some environments may have more
APIs defined when compared to other environments.

## Installation
This application is meant to be used as a command line tool.
You can install the latest version globally:
```bash
npm install -g skull-island
```

If you have an older version and need to upgrade to the latest version:
```bash
npm upgrade -g skull-island
```

## Running the application

### Backup
In order to backup a running Kong API gateway configuration to disk, use
the `backup` command:
```bash
skull-island backup --url http://127.0.0.1:8001
```

Kong API Gateway is running on `127.0.0.1` and the administration port
is running on port `8001`. You can find additional parameters using
`skull-island backup -h`. The default backup file is generated in the
current directory called `kong-backup.json`.

### Synchronization
In order to synchronize a configuration on disk to a running Kong API
Gateway, use the `synchronize` command:
```bash
skull-island synchronize --url http://127.0.0.1:8001
```

Kong API Gateway is running on `127.0.0.1` and the administration port
is running on port `8001`. You can find additional parameters using
`skull-island synchronize -h`. The default backup file that is used for
the synchronization process must exist in the current directory and is
expected to be called `kong-backup.json`.

### Teardown
In order to wipe a Kong API Gateway clean of entities (APIs, Plugins,
Consumers, and Consumer Credentials), use the `teardown` command:
```bash
skull-island teardown --url http://127.0.0.1:8001
```

Kong API Gateway is running on `127.0.0.1` and the administration port
is running on port `8001`.

## Building out a Kong API gateway environment for testing
Ensure you have the latest version of Docker running:

### Docker Compose
To bring up Cassandra and the Kong API Gateway, use
```
docker-compose up
```

You can add a `-d` flag if you want to run it in the background and not
have the logs pollute your terminal.

Once you are finished, and want to clean up, use
```
docker-compose down
```

### Just Docker
1. create a virtual Docker network that will host Kong and Cassandra so
they may communicate with each other

    ```
    docker network create kong-network
    ```

2. create the Cassandra Docker container on the `kong-network`

    ```
    docker run -d --name kong-database --network kong-network cassandra:3
    ```

3. create the Kong API Gateway Docker container on the `kong-network` and
expose ports over to the host network to access the admin and proxy APIs

    ```
    docker run -d --name kong --network kong-network -e "KONG_DATABASE=cassandra"
      -e "KONG_CASSANDRA_CONTACT_POINTS=kong-database"
      -p 8000:8000
      -p 8443:8443
      -p 8001:8001
      -p 7946:7946
      -p 7946:7946/udp
      kong:latest
    ```

### Notes
To my understanding, the dependency graph can be visualized like this:

`Consumer`s -depend on-> `Plugin`s -depend on-> `API`s


There are global `Plugin`s which have no dependency on `API`s like `Syslog`.
So in terms of deleting or adding, you need to start with the `Consumer`s,
followed by `Plugin`s and finally `API`s.


In order to perform a synchronization, you need to pull down the current
state of the API gateway and have the backup file on hand. You need to
perform the following steps for Consumers, Plugins and APIs

- Check what is present in the backup file and compare the entries to
the entries pulled from the API gateway,
    - if we have less entries in the file then we need to remove entries
    from the API gateway.
    - If we have more entries in the file then we need to add entries
    into the API gateway

- See if existing entries need to be updated (you could always blindly
update the server with the data from the file to avoid complications)

*Note*: you cannot rely on blind updates to existing records
(for Consumer Credentials), you must look at each one for differences
and if you find differences, then delete the one on the server and
upload the new one. You could actually do this process blindly
(delete then add).
