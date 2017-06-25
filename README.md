# Skull Island for Kong API Gateway #
Skull Island is a declarative configuration management tool to backup and synchronize Kong API Gateway configuration.
We recommend using [Kong Dashboard](https://github.com/PGBI/kong-dashboard) to add routes through a UI and then using
Skull Island to backup the configuration changes and later synchronize it.

## Building out a Kong API gateway environment for testing
Ensure you have the latest version of Docker running:

- create a virtual Docker network that will host Kong and Cassandra so they may communicate with each other

    ```
    docker network create kong-network
    ```

- create the Cassandra Docker container on the `kong-network`

    ```
    docker run -d --name kong-database --network kong-network cassandra:3
    ```

- create the Kong API Gateway Docker container on the `kong-network` and expose ports over to the host network to access
the admin and proxy APIs

    ```
    docker run -d --name kong --network kong-network -e "KONG_DATABASE=cassandra" \
      -e "KONG_CASSANDRA_CONTACT_POINTS=kong-database" \
      -p 8000:8000 \
      -p 8443:8443 \
      -p 8001:8001 \
      -p 7946:7946 \
      -p 7946:7946/udp \
      kong:latest
    ```