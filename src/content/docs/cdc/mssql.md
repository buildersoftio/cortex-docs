---
title: Microsoft SQL Server CDC
description: An overview of Change data capture for Microsoft SQL Server in Cortex Data Framework
---

## Using CDC in Cortex: Microsoft SQL Server

The **Microsoft SQL Server CDC Source Operator** is Cortex's current implementation of Change Data Capture. It allows Cortex to stream data changes from a SQL Server database into a processing pipeline in real-time.

### Overview

The SqlServerCDCSourceOperator integrates with Microsoft SQL Server to capture row-level data changes. Under the hood, it leverages SQL Server’s built-in [Change Data Capture (CDC)](https://learn.microsoft.com/en-us/sql/relational-databases/track-changes/about-change-data-capture-sql-server?view=sql-server-ver16) to track inserts, updates, and deletes.

**Key Features**
- **Optional Automatic CDC Enablement**: When `ConfigureCDCInServer = true`, the operator attempts to enable database/table-level CDC if not already enabled.
- **Initial Load**: If `DoInitialLoad = true`, the operator performs a single pass over the table before streaming incremental changes.
- **Polling Interval**: Configurable via PullInterval, controlling how frequently changes are polled from the CDC tables.
- **Checkpointing**: Stores last processed LSN (Log Sequence Number) plus a last-record hash to prevent duplicate emissions.
- **Error Handling**: Uses exceptions with exponential back-off to avoid overloading the system if issues arise repeatedly.

**How It Works**

1. **CDC Enablement**:
    - Checks if CDC is enabled on the target database and table.
    - If `ConfigureCDCInServer` is set, it can automatically enable CDC.
2. **Initial Load (Optional)**:
    - If `DoInitialLoad` is true and not previously completed, the operator reads all existing rows from the table.
    - Emits each row as a stream event before moving to change tracking.
3. **Continuous Polling for Changes**:
    - Periodically polls the SQL Server CDC tables using functions like `cdc.fn_cdc_get_all_changes_<capture_instance>`.
    - Uses a configurable `PullInterval` to define the delay between polls.
4. **Duplicate Filtering**:
    - Computes an MD5 hash of each record's data.
    - Compares it with the hash of the last emitted record to avoid duplicates.
5. **Checkpointing**:
    - Maintains and updates a checkpoint (LSN and record hash) in a state store.
    - Ensures that upon restart, streaming resumes from the last processed change without data loss or duplication.

### Server Configuration Prerequisites for SQL Server
1. **Enable SQL Server Agent**

SQL Server Agent must be running because CDC relies on it to capture changes in the background.

2. **Permissions**
    - You must have sufficient privileges (`sysadmin` or `db_owner`) to enable CDC at the database and table levels.
    - If `ConfigureCDCInServer` is `true`, the Cortex CDC operator will attempt:
    ```sql
        EXEC sys.sp_cdc_enable_db;
        EXEC sys.sp_cdc_enable_table ...
    ```
    - If `ConfigureCDCInServer` is `false`, you should manually enable CDC on the database and table before using the operator.

3. **Database Log Growth**
    - CDC can increase the transaction log usage. Ensure you have proper log retention and space provisioning.

###  CDC Support by SQL Server Version

- **Introduced in SQL Server 2008 (Enterprise Edition)**.
- **SQL Server 2016 SP1** and later supports CDC in **Standard Edition** as well.
- **Azure SQL Database** also has CDC support in certain service tiers.
- If you are using an older or unsupported SQL Server edition, you may not have native CDC functionality.

### Example docker-compose for SQL Server
Below is a minimal example of running SQL Server in a Docker container (2019 version). CDC is available from 2008 onward, but 2019 is commonly used:
```yaml
version: '3.8'
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2019-latest
    container_name: sqlserver_cdc
    environment:
      - ACCEPT_EULA=Y
      - MSSQL_SA_PASSWORD=YourStrong@Passw0rd
      - MSSQL_PID=Developer
    ports:
      - "1433:1433"
    healthcheck:
      test: ["CMD", "/opt/mssql-tools/bin/sqlcmd", "-U", "sa", "-P", "YourStrong@Passw0rd", "-Q", "SELECT 1"]
      interval: 10s
      timeout: 5s
      retries: 5
```
- **Developer Edition** includes CDC functionality.
- After starting, you can connect to this SQL Server from Cortex or any client at `localhost:1433`.

## Using CDC in Cortex: Microsoft SQL Server

The **Microsoft SQL Server CDC Source Operator** is Cortex's implementation for capturing and streaming data changes from SQL Server databases. Below are various usage examples demonstrating how to configure and utilize this operator effectively.

### Prerequisites
- **Cortex Setup**: Ensure that Cortex is installed and properly configured in your environment.
- **SQL Server CDC Enabled**: CDC must be enabled on your target SQL Server database and the specific tables you intend to monitor. Cortex can automate this process if configured accordingly.

### Example 1: Basic CDC Stream with Default Settings

**Scenario**: Set up a CDC stream to capture all change events from a SQL Server table with default settings, including performing an initial data load.
**Configuration Highlights**:
- **Initial Load**: Enabled (``DoInitialLoad = true``) to read existing table data before streaming changes.
- **Polling Interval**: Default interval of 3 seconds (``PullInterval = TimeSpan.FromSeconds(3)``).
- **CDC Configuration**: Automatic CDC enablement is disabled (``ConfigureCDCInServer = false``).

**Usage**:

```csharp
using Cortex.Streams;
using Cortex.Streams.MSSqlServer;

// Define connection and table details.
string connectionString = "Server=myServer;Database=myDB;User Id=myUser;Password=myPass;";
string schemaName = "dbo";
string tableName = "Orders";

// Configure CDC settings with default options.
var sqlServerSettings = new SqlServerSettings
{
    DoInitialLoad = true,                // Perform initial full load.
    PullInterval = TimeSpan.FromSeconds(3),  // Poll every 3 seconds.
    ConfigureCDCInServer = false          // Do not automatically enable CDC.
};

// Create a CDC source operator.
var cdcSourceOperator = new SqlServerCDCSourceOperator(
    connectionString,
    schemaName,
    tableName,
    sqlServerSettings
);

// Build a stream using the CDC source.
var stream = StreamBuilder<SqlServerRecord, SqlServerRecord>
    .CreateNewStream("SQL Server CDC Stream")
    .Stream(cdcSourceOperator)             // Use CDC source as the stream origin.
    .Sink(record => Console.WriteLine($"Change Detected: {record.Operation} - {record.Data}"))
    .Build();

// Start the stream to begin processing CDC events.
stream.Start();
```

**Explanation**:

- **Initial Load**: The operator reads existing records from the `Orders` table and emits them as `SqlServerRecord` events.
- **Continuous Polling**: After the initial load, the operator polls for new changes every 3 seconds.
- **Sink**: Detected changes are printed to the console.

### Example 2: CDC Stream with Automatic CDC Configuration

**Scenario**: Allow Cortex to automatically enable CDC on the SQL Server database and target table if it's not already enabled.

**Configuration Highlights**:

- **Automatic CDC Configuration**: Enabled (`ConfigureCDCInServer = true`).
- **Use Case**: Simplifies setup by letting Cortex manage CDC enablement, ensuring that CDC is active without manual intervention.

**Usage**:

```csharp
using Cortex.Streams;
using Cortex.Streams.MSSqlServer;

// Define connection and table details.
string connectionString = "Server=myServer;Database=myDB;User Id=myUser;Password=myPass;";
string schemaName = "hr";
string tableName = "Employees";

// Configure CDC settings with automatic CDC enablement.
var sqlServerSettings = new SqlServerSettings
{
    DoInitialLoad = true,                 // Perform initial data load.
    PullInterval = TimeSpan.FromSeconds(4),  // Poll every 4 seconds.
    ConfigureCDCInServer = true            // Automatically enable CDC if not enabled.
};

// Create a CDC source operator.
var cdcSourceOperator = new SqlServerCDCSourceOperator(
    connectionString,
    schemaName,
    tableName,
    sqlServerSettings
);

// Build a stream using the CDC source.
var stream = StreamBuilder<SqlServerRecord, SqlServerRecord>
    .CreateNewStream("SQL Server CDC Stream - Auto CDC")
    .Stream(cdcSourceOperator)             
    .Sink(record => Console.WriteLine($"Employee Change: {record.Operation} - {record.Data}"))
    .Build();

// Start the stream to begin processing CDC events.
stream.Start();
```

**Explanation**:

- **Automatic CDC Configuration**: Enabled, allowing Cortex to activate CDC on the Employees table if it isn't already enabled.
- **Initial Load and Polling**: Configured to perform an initial data load and poll every 4 seconds.
- **Sink**: Outputs all change operations related to employees.

### Example 3: CDC Stream with Persistent State Store

**Scenario**: Utilize a persistent state store to ensure checkpoint data persists across application restarts, providing fault tolerance and data integrity.

**Configuration Highlights**:

- **State Store**: Custom persistent `IDataStore` implementation is provided.
- **Use Case**: Essential for production environments where stream processing must resume accurately after failures.

```csharp
using Cortex.Streams;
using Cortex.Streams.MSSqlServer;
using Cortex.States;
using Cortex.States.Operators;

// Define connection and table details.
string connectionString = "Server=myServer;Database=myDB;User Id=myUser;Password=myPass;";
string schemaName = "inventory";
string tableName = "Products";

// Implement a persistent IDataStore (e.g., external database).
IDataStore<string, byte[]> checkpointStateStore = new new RocksDbStateStore<string, int>("ExampleStateStore", "./data");

// Configure CDC settings with persistent state store.
var sqlServerSettings = new SqlServerSettings
{
    DoInitialLoad = true,                     // Perform initial data load.
    PullInterval = TimeSpan.FromSeconds(6),      // Poll every 6 seconds.
    ConfigureCDCInServer = true,               // Automatically enable CDC if necessary.
};

// Create a CDC source operator with the persistent state store.
var cdcSourceOperator = new SqlServerCDCSourceOperator(
    connectionString,
    schemaName,
    tableName,
    sqlServerSettings,
    checkpointStateStore
);

// Build a stream using the CDC source.
var stream = StreamBuilder<SqlServerRecord, SqlServerRecord>
    .CreateNewStream("SQL Server CDC Stream - Persistent State")
    .Stream(cdcSourceOperator)             
    .Sink(record => Console.WriteLine($"Inventory Update: {record.Operation} - {record.Data}"))
    .Build();

// Start the stream to begin processing CDC events.
stream.Start();
```
**Explanation**:

- **Persistent State Store**:  RocksDbStateStore is used to persist checkpoint information to RocksDb.
- **Fault Tolerance**: Ensures that upon restarting the application, the CDC operator resumes from the last processed Log Sequence Number (LSN), preventing data loss or duplication.
- **Sink**: Outputs all inventory-related change events.

### Example 9: CDC Stream with Complex Transformation and Routing

**Scenario**: Apply complex data transformations and route change events to different sinks based on specific criteria.

**Configuration Highlights**:

- **Map Operator**: Transforms SqlServerRecord into a custom data structure.
- **Branching**: Routes transformed records to different sinks based on operation type.
- **Use Case**: Enables sophisticated processing pipelines where different types of changes trigger different actions.

**Usage**:

```csharp
using Cortex.Streams;
using Cortex.Streams.MSSqlServer;

// Define connection and table details.
string connectionString = "Server=myServer;Database=myDB;User Id=myUser;Password=myPass;";
string schemaName = "operations";
string tableName = "Logs";

// Configure CDC settings.
var sqlServerSettings = new SqlServerSettings
{
    DoInitialLoad = true,                      // Perform initial data load.
    PullInterval = TimeSpan.FromSeconds(2),       // Poll every 2 seconds.
    ConfigureCDCInServer = true                 // Automatically enable CDC if necessary.
};

// Create a CDC source operator.
var cdcSourceOperator = new SqlServerCDCSourceOperator(
    connectionString,
    schemaName,
    tableName,
    sqlServerSettings
);

// Build a stream with complex transformations and routing.
var stream = StreamBuilder<SqlServerRecord, SqlServerRecord>
    .CreateNewStream("SQL Server CDC Stream - Complex Routing")
    .Stream(cdcSourceOperator)             
    .Map(record => new 
    { 
        Operation = record.Operation, 
        Message = record.Data["Message"]?.ToString(), 
        Severity = record.Data["Severity"]?.ToString(),
        Timestamp = record.ChangeTime 
    })  // Transform records to a custom anonymous type.
    .AddBranch("ErrorLogs", branch => 
    {
        branch.Filter(r => r.Severity == "Error")
               .Sink(r => Console.WriteLine($"Error Log: {r.Message} at {r.Timestamp}"));
    })
    .AddBranch("InfoLogs", branch => 
    {
        branch.Filter(r => r.Severity == "Info")
               .Sink(r => Console.WriteLine($"Info Log: {r.Message} at {r.Timestamp}"));
    })
    .Build();

// Start the stream to begin processing CDC events.
stream.Start();
```

**Explanation**:

- **Map Operator**: Transforms SqlServerRecord into a structured anonymous type containing operation type, message, severity, and timestamp.
Branching:
    - **ErrorLogs Branch**: Filters for records with Severity equal to "Error" and outputs them to the console.
    - **InfoLogs Branch**: Filters for records with Severity equal to "Info" and outputs them separately.
- **Benefits**: Allows different handling of various log severities, enabling specialized processing or alerting mechanisms for critical events.

## Best Practices for Using CDC in Cortex

1. **Enable CDC Properly**:
    - Ensure CDC is enabled on both the database and target tables.
    - Use `ConfigureCDCInServer = true` during initial setup to automate CDC enablement if appropriate.
2. **Choose Appropriate Polling Intervals**:
    - Balance between data freshness and system performance.
    - Higher intervals reduce database load but increase data latency.
3. **Use Persistent State Stores**:
    - For production environments, always use a persistent `IDataStore` to maintain checkpoint and hash data, ensuring reliability across restarts.
4. **Implement Robust Filtering**:
    - Use Cortex's filter operators to process only relevant change events, optimizing resource usage.
5. **Leverage Telemetry**:
     - Integrate telemetry providers to monitor operator performance, track metrics, and facilitate troubleshooting.
6. **Handle Duplicates Carefully**:
    - Ensure that duplicate filtering mechanisms are correctly configured and that the state store reliably maintains hash data.
7. **Test Thoroughly**:
    - Validate CDC streams under various scenarios, including high data volumes, operator restarts, and failure conditions to ensure resilience.
8. **Secure Connections**:
    - Protect database connection strings and credentials.
    - Follow security best practices to safeguard data integrity and privacy.
