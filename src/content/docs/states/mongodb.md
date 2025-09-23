--- 
title: MongoDB Store
description: An overview of Cortex MongoDb Store
---


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