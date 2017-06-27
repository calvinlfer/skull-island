# Skull Island
Skull Island is a declarative configuration management tool for
[Kong API Gateway](https://getkong.org/) to backup and synchronize Kong
API Gateway configuration. We recommend using [Kong Dashboard](https://github.com/PGBI/kong-dashboard)
to add routes through a UI and then using Skull Island to backup the
configuration changes and later synchronize it.

<h5>
    <span style="color:red">This is a work-in-progress, please use at your own risk</span>
</h5>

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
