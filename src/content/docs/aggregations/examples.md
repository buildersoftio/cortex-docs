---
title: Examples with Aggregations
description: An overview of examples with Aggregations in Cortex Streams
---

### Example: Building Customer Aggregates

Consider `CustomerEvents`. Each event could represent a change in a customer's profile or purchases. We want to:

1. Group events by `CustomerId`.
2. Aggregate them into a `CustomerProfile` object that maintains the latest information.

Assume:

```csharp
public class CustomerEvent 
{
    public string CustomerId { get; set; }
    public string EventType { get; set; } // e.g., "Purchase", "ProfileUpdate"
    public decimal PurchaseAmount { get; set; }
    public string UpdatedName { get; set; }
    // ... other event fields
}

public class CustomerProfile
{
    public string CustomerId { get; set; }
    public decimal TotalPurchases { get; set; }
    public string Name { get; set; }
}
```

Building the stream
```csharp
// Creating a new stream for Customer Events
var customerStream = StreamBuilder<CustomerEvent, CustomerEvent>
    .CreateNewStream("CustomerEventStream")
    .Stream() // In-app streaming source

    // Group by CustomerId and then Aggregate
    .GroupBy(e => e.CustomerId)  // Groups events by CustomerId
    .Aggregate<string, CustomerProfile>(
        keySelector: kvp => kvp.Key,
        aggregateFunction: (CustomerProfileAggregate, kvpEvent) =>
        {
            // kvpEvent.Value is the original event
            var currentProfile = CustomerProfileAggregate; // This is our TAggregate
            var newEvent = kvpEvent.Value;

            if (currentProfile == null)
                currentProfile = new CustomerProfile { CustomerId = newEvent.Last().CustomerId };

            // Apply changes
            if (newEvent.Last().EventType == "Purchase")
                currentProfile.TotalPurchases += newEvent.Last().PurchaseAmount;

            if (newEvent.Last().EventType == "ProfileUpdate")
                currentProfile.Name = newEvent.Last().UpdatedName;

            return currentProfile;
        }
    )
    .Sink(profileKvp =>
    {
        Console.WriteLine($"CustomerID: {profileKvp.Key}, Total Purchases: {profileKvp.Value.TotalPurchases}, Name: {profileKvp.Value.Name}");
    })
    .Build();

// Start the stream
customerStream.Start();

// Emit some events
customerStream.Emit(new CustomerEvent { CustomerId = "C001", EventType = "ProfileUpdate", UpdatedName = "Alice" });
customerStream.Emit(new CustomerEvent { CustomerId = "C001", EventType = "Purchase", PurchaseAmount = 100 });
customerStream.Emit(new CustomerEvent { CustomerId = "C002", EventType = "ProfileUpdate", UpdatedName = "Bob" });
customerStream.Emit(new CustomerEvent { CustomerId = "C001", EventType = "Purchase", PurchaseAmount = 50 });

// Output:
// CustomerID: C001, Total Purchases: 0, Name: Alice
// CustomerID: C001, Total Purchases: 100, Name: Alice
// CustomerID: C002, Total Purchases: 0, Name: Bob
// CustomerID: C001, Total Purchases: 150, Name: Alice

customerStream.Stop();
```


**In the above example**:

1. We start by grouping customer events using `.GroupBy(...)`.
2. We then apply `.Aggregate(...)` with a custom aggregation function. Whenever a new event for a given customer arrives, we update their profile state in the state store.
3. The output is a `KeyValuePair<CustomerId, CustomerProfile>` that you can consume in the sink.


## Silent Aggregations
If you do not want the aggregation operator to alter the shape of the stream (for instance, you want to maintain state silently), you can use `GroupBySilently(...)` and `AggregateSilently(...)`. These operators maintain the state internally while passing the original events down the pipeline unchanged.

### Example

```csharp
var silentAggregateStream = StreamBuilder<CustomerEvent, CustomerEvent>
    .CreateNewStream("SilentAggregationStream")
    .Stream()
    .GroupBySilently(e => e.CustomerId)
    .AggregateSilently<string, CustomerProfile>(
        keySelector: e => e.CustomerId,
        aggregateFunction: (currentProfile, newEvent) =>
        {
            if (currentProfile == null)
                currentProfile = new CustomerProfile { CustomerId = newEvent.CustomerId };

            if (newEvent.EventType == "Purchase")
                currentProfile.TotalPurchases += newEvent.PurchaseAmount;
            if (newEvent.EventType == "ProfileUpdate")
                currentProfile.Name = newEvent.UpdatedName;

            return currentProfile;
        }
    )
    .Sink(e => Console.WriteLine($"Event processed: {e.CustomerId}, EventType: {e.EventType}"))
    .Build();

silentAggregateStream.Start();
silentAggregateStream.Emit(new CustomerEvent { CustomerId = "C003", EventType = "Purchase", PurchaseAmount = 200 });
// In this case, no aggregated data is emitted, but the state store has been updated and the output is as following:

// Output:
// Event processed: C003, EventType: Purchase
silentAggregateStream.Stop();
```

**Key Points**
- **GroupBy** partitions the stream by key, storing events in a state store.
- **Aggregate** reduces these grouped events to a single, cumulative state object per key.
- **Silent** versions do the same state maintenance without altering the event flow or output format.
- Aggregations are essential for stateful streaming applications where insights are derived from accumulated data over time.


## State Store Options for Aggregations

Cortex supports multiple state store options to persist the state of aggregations. These state stores ensure that the state is maintained across application restarts and failures. The supported state stores are:

1. **RocksDbStateStore**
2. **CassandraStateStore**
3. **MongoDbStateStore**

### RocksDbStateStore

The `RocksDbStateStore` is a high-performance, persistent key-value store based on RocksDB. It is suitable for applications requiring durable state management.

**Configuration Example:**

```csharp
using Cortex.States.RocksDb;
using Cortex.Streams;

var rocksDbStateStore = new RocksDbStateStore<string, int>("RocksDbStore", "/path/to/rocksdb");

var stream = StreamBuilder<string, string>.CreateNewStream("RocksDbStream")
    .Stream()
    .Aggregate(
        keySelector: word => word,
        aggregateFunction: (currentCount, word) => currentCount + 1,
        stateStoreName: "RocksDbStore",
        stateStore: rocksDbStateStore
    )
    .Sink(msg => Console.WriteLine($"Word processed: {msg}"))
    .Build();

stream.Start();
stream.Emit("apple");
stream.Emit("banana");
stream.Stop();

rocksDbStateStore.Dispose();
```

### Cassandra State Store

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

### MongoDb State Store

The `MongoDbStateStore` uses MongoDB, a popular NoSQL database, to persist state. It is suitable for applications requiring flexible schema design and rich querying capabilities.
**Configuration Example:**

```csharp
using Cortex.States.MongoDb;
using Cortex.Streams;

var client = new MongoClient("mongodb://{username}:{password}@localhost:27017");
var database = client.GetDatabase("cortex_testing");

var mongoDbStateStore = new MongoDbStateStore<string, int>("stateStoreName", database, "collectionName");

var stream = StreamBuilder<string, string>.CreateNewStream("MongoDbStream")
    .Stream()
    .Aggregate(
        keySelector: word => word,
        aggregateFunction: (currentCount, word) => currentCount + 1,
        stateStoreName: "MongoDbStore",
        stateStore: mongoDbStateStore
    )
    .Sink(msg => Console.WriteLine($"Word processed: {msg}"))
    .Build();

stream.Start();
stream.Emit("apple");
stream.Emit("banana");
stream.Stop();

mongoDbStateStore.Dispose();
```

**Key Points**

- **RocksDbStateStore**: High-performance, persistent key-value store.
- **CassandraStateStore**: Highly scalable, distributed NoSQL database.
- **MongoDbStateStore**: Flexible schema design and rich querying capabilities.
Choose the state store that best fits your application's requirements for durability, scalability, and querying capabilities.