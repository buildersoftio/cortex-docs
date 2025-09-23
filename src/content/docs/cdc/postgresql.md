---
title: PostgreSQL Database CDC
description: An overview of Change data capture for PostgreSQL in Cortex Data Framework
---


## Overview
The **PostgresSourceOperator** uses **logical replication** and the **wal2json** plugin to capture changes from PostgreSQL in real-time. It optionally sets up or verifies a publication and logical replication slot if configured to do so.

**Key Features**
- **Optional Automatic Setup**: When `ConfigureCDCInServer = true`, attempts to create a publication (`my_publication`) and a logical replication slot (`my_slot`) if they do not exist.
- **Replica Identity**: Supports setting `REPLICA IDENTITY` to `DEFAULT` or `FULL` (via `ReplicaIdentityMode`) for more complete update/delete data.
- **Initial Load**: If `DoInitialLoad = true`, performs a single `SELECT * FROM schema.table` before streaming from the WAL.
- **Checkpointing**: Maintains the last processed LSN in the state store to resume from the same position upon restart.

## Server Configuration Prerequisites for PostgreSQL
1. **wal_level = logical**\
    In your postgresql.conf, ensure:
    ```bash
    wal_level = logical
    ```
    Then restart PostgreSQL for changes to take effect.
2. **Role Privileges**\
The user connecting must have replication privileges (superuser or a role with replication rights) in order to create and read from logical replication slots.

3. **Plugin Installation**
    - The operator uses the wal2json plugin. Make sure wal2json is installed on your PostgreSQL instance. On some distributions, you may need to install it separately.

    > **Installing wal2json**:\
    On many systems, wal2json is included by default. Otherwise, install from your package manager or build from source. For example on Debian/Ubuntu:
    ```bash
    sudo apt-get install postgresql-14-wal2json
    ```

4. **Publication / Slot**
    - If `ConfigureCDCInServer = false`, you must manually create a publication and replication slot. Example:
    ```sql
    CREATE PUBLICATION my_publication FOR TABLE my_schema.my_table;
    SELECT * FROM pg_create_logical_replication_slot('my_slot', 'wal2json');
    ```

## Basic Usage Example

```csharp
using Cortex.Streams;
using Cortex.Streams.PostgreSQL;
using Cortex.States;

// 1. Setup connection & table info
string connectionString = "Host=myHost;Database=myDB;Username=myUser;Password=myPass;";
string schemaName = "public";
string tableName = "Customers";

// 2. Configure Postgres settings
var postgresSettings = new PostgresSettings
{
    DoInitialLoad = true,
    PullInterval = TimeSpan.FromSeconds(3),
    ConfigureCDCInServer = true,
    ReplicaIdentity = ReplicaIdentityMode.Full  // Ensure full row data for DELETEs
};

// 3. Create the Postgres CDC source
var pgCdcOperator = new PostgresSourceOperator(
    connectionString,
    schemaName,
    tableName,
    slotName: "my_slot",
    publicationName: "my_publication",
    postgresSettings
);

// 4. Build and start the stream
var stream = StreamBuilder<PostgresRecord, PostgresRecord>
    .CreateNewStream("Postgres CDC Stream")
    .Stream(pgCdcOperator)
    .Sink(record =>
    {
        Console.WriteLine($"[PostgresCDC] {record.Operation} => {record.Data.Count} columns changed.");
    })
    .Build();

stream.Start();
```

## Handling Complex Scenarios
- **Multiple Tables**: Create multiple operators (or a single publication with multiple tables) and configure them accordingly.
- **Clustering / HA**: For high availability, ensure the replication slot is managed in your failover strategy.
- **Performance**: Tuning `wal2json` parameters, like `pretty-print`, or chunking large transactions, can improve throughput.

