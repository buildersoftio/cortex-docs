---
title: MongoDB CDC
description: An overview of Change data capture for MongoDb in Cortex Data Framework
---


## Overview
The **MongoDbCDCSourceOperator** uses **MongoDB Change Streams** to capture real-time changes (inserts, updates, replacements, deletes) on a collection. Optionally, it can perform an initial full scan of the collection if desired.

**Key Features**
- **Change Stream**: Reliably captures changes from a replica set or sharded cluster without manual polling.
- **Optional Initial Load**: If `DoInitialLoad = true`, the entire collection is read once.
- **Checkpointing**: Stores a resume token from the change stream plus a record hash to skip duplicates.
- **Error Handling**: Retries on errors with a back-off approach; gracefully handles operator stop signals.

## Server Configuration Prerequisites for MongoDb
1. **Replica Set or Sharded Cluster**\
MongoDB Change Streams only work on a replica set or a sharded cluster.
    - For a single-node developer instance, initialize a replica set locally
    ```javascript
    // In the mongo shell:
    rs.initiate()
    ```

2. **Database User Permissions**
The user must have permission to read the oplog or have the `changeStream` privilege on the database in question.
3. **MongoDB Version**
Change Streams are supported in MongoDB 3.6+ with feature enhancements in later versions. Ensure you’re running a compatible version.

## Basic Usage Example

```csharp
using Cortex.Streams;
using Cortex.Streams.MongoDb;
using MongoDB.Driver;
using Cortex.States;

// 1. Setup MongoDB client & collection details
var client = new MongoClient("mongodb://localhost:27017");
var database = client.GetDatabase("myDb");
string collectionName = "Products";

// 2. Configure MongoDB CDC settings
var mongoCdcSettings = new MongoDbCDCSettings
{
    DoInitialLoad = true,          // Read entire collection first
    Delay = TimeSpan.FromSeconds(3),
    MaxBackOffSeconds = 60
};

// 3. Create the operator
var cdcOperator = new MongoDbCDCSourceOperator(
    database,
    collectionName,
    mongoCdcSettings
);

// 4. Build a stream
var stream = StreamBuilder<MongoDbRecord, MongoDbRecord>
    .CreateNewStream("MongoDB CDC Stream")
    .Stream(cdcOperator)
    .Sink(record =>
    {
        Console.WriteLine($"[MongoCDC] Operation: {record.Operation}, Document: {record.Data}");
    })
    .Build();

// 5. Start streaming
stream.Start();
```

## Additional Considerations
- **Single vs. Multiple Collections**: Each **MongoDbCDCSourceOperator** targets one collection. For multiple collections, instantiate multiple operators or watch the entire database if needed (using `$changeStream` at the DB level).
- **OpLog Size**: Ensure your replica set’s oplog is sized appropriately if you expect to handle high write volumes.
- **Filtering**: You can filter on specific operation types (insert, update, delete) using stream operators within Cortex if needed.