---
title: Cassandra Database
description: An overview of Cortex Cassandra DB Store
---

The `CassandraStateStore` uses Apache Cassandra, a highly scalable NoSQL database, to persist state. It is ideal for distributed applications requiring high availability and fault tolerance.

**Configuration Example:**

```csharp
using Cortex.States.Cassandra;
using Cortex.Streams;

var cluster = Cluster.Builder()
    .AddContactPoint("localhost")
    .Build();
var session = cluster.Connect();

var cassandraStateStore = new CassandraStateStore<string, int>("CassandraStore", "keyspace", "tableName",session);

var stream = StreamBuilder<string, string>.CreateNewStream("CassandraStream")
    .Stream()
    .Aggregate(
        keySelector: word => word,
        aggregateFunction: (currentCount, word) => currentCount + 1,
        stateStoreName: "CassandraStore",
        stateStore: cassandraStateStore
    )
    .Sink(msg => Console.WriteLine($"Word processed: {msg}"))
    .Build();

stream.Start();
stream.Emit("apple");
stream.Emit("banana");
stream.Stop();

cassandraStateStore.Dispose();
```