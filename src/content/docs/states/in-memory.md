---
title: In-Memory Store
description: An overview of Cortex In-Memory Store
---


In scenarios where state persistence is not required, **In-Memory State Stores** offer a lightweight and fast alternative for managing state within stream processing pipelines. These state stores maintain state information in memory, providing quick access and manipulation but lacking durability across application restarts.

### Description and Use Cases

**In-Memory State Stores** are transient storage mechanisms that keep state data in the application's memory space. They are ideal for use cases where:

- **State Durability is Not Critical**: Applications where losing state data upon restart is acceptable.
- **High-Speed Access**: Scenarios requiring extremely low-latency access to state data.
- **Testing and Development**: Environments where persistent state is unnecessary or cumbersome.
- **Ephemeral State Requirements**: Temporary state management for short-lived processing tasks.

**Key Features:**

- **Fast Access**: Data is stored in memory, enabling rapid read and write operations.
- **Simplicity**: Easy to implement and integrate without the need for external dependencies.
- **Non-Persistent**: State data is lost when the application stops or crashes.
- **Lightweight**: Minimal resource overhead compared to persistent state stores.

**Benefits:**

- **Performance**: Superior performance for state access due to in-memory storage.
- **Ease of Use**: No configuration or setup required for external storage systems.
- **Resource Efficiency**: Suitable for applications with limited state management needs.

**Limitations:**

- **Volatility**: State data is not retained across application restarts or failures.
- **Memory Consumption**: Limited by the available system memory, which may restrict the size of state data.
**Use Cases:**

- **Real-Time Dashboards**: Maintaining transient metrics for live monitoring.
- **Temporary Aggregations**: Performing on-the-fly calculations without needing to persist results.
- **Short-Lived Applications**: Applications where state is only relevant during a single execution session.

### Implementation Guide
Implementing an **In-Memory State Store** involves using built-in or custom classes that store state data within the application's memory. Below are the steps to set up and utilize an in-memory state store.


**Step-by-Step Implementation**:

1. **Define the Key and Value Types**:\
Decide on the types for keys and values that the state store will manage. For example, keys can be strings or integers, and values can be any serializable type.

2. **Initialize the In-Memory State Store**:\
Create an instance of `InMemoryStateStore<TKey, TValue>`, specifying the store name.
    ```csharp
    using Cortex.States.InMemory;

    // Initialize an In-Memory State Store for session counts
    var sessionCountStore = new InMemoryStateStore<string, int>("SessionCountStore");
    ```
3. **Integrate with Stateful Operators**:\
Pass the in-memory state store to operators that require state management, such as `AggregateOperator` or window operators.

    ```csharp
    using Cortex.Streams;
    using Cortex.Streams.Operators;

    var stream = StreamBuilder<string, string>.CreateNewStream("InMemoryStateStream")
        .Stream()
        .Aggregate(
            keySelector: session => session,                     // Group by session ID
            aggregateFunction: (currentCount, session) => currentCount + 1, // Increment session count
            stateStoreName: "SessionCountStore",
            stateStore: sessionCountStore
        )
        .Sink(msg => Console.WriteLine($"Message processed: {msg}"))
        .Build();
    ```

4. **Manage State Operations**:
- **Putting Data**: Insert or update key-value pairs using the `Put` method.
- **Getting Data**: Retrieve values based on keys using the `Get` method.
- **Removing Data**: Delete specific entries using the `Remove` method.
- **Clearing State**: Remove all entries if needed using the `Clear` method.
- **Enumerating State**: Iterate over all key-value pairs using the `GetAll` method.

5. **Handle Stream Lifecycle**:\
Start and stop the stream as usual, keeping in mind that state data will not persist after stopping the application.

> **Note**: Since in-memory state stores are transient, ensure that their usage aligns with the application's requirements for state persistence and durability.

### Code Example

Below is a practical code example demonstrating the usage of an In-Memory State Store within a stream that counts user sessions using the `AggregateOperator`. The example showcases initializing the state store, configuring the stream with aggregation, and emitting data.

```csharp
using Cortex.States.InMemory;
using Cortex.Streams;
using Cortex.Streams.Operators;
using System;

class Program
{
    static void Main(string[] args)
    {
        // Initialize an In-Memory State Store for session counts
        var sessionCountStore = new InMemoryStateStore<string, int>("SessionCountStore");

        // Create and configure the stream with an Aggregate operator
        var stream = StreamBuilder<string, string>.CreateNewStream("SessionStream")
            .Stream()
            .Aggregate(
                keySelector: sessionId => sessionId,                      // Group by session ID
                aggregateFunction: (currentCount, sessionId) => currentCount + 1, // Increment count
                stateStoreName: "SessionCountStore",
                stateStore: sessionCountStore
            )
            .Sink(msg => Console.WriteLine($"Message processed: {msg}"))
            .Build();

        // Start the stream
        stream.Start();

        // Emit data into the stream
        var sessions = new[] { "SessionA", "SessionB", "SessionA", "SessionC", "SessionB", "SessionA" };
        foreach (var session in sessions)
        {
            stream.Emit(session);
        }

        // Stop the stream after processing
        stream.Stop();
    }
}
```

**Explanation**:
1. **State Store Initialization**:
    ```csharp
    var sessionCountStore = new InMemoryStateStore<string, int>("SessionCountStore");
    ```
    - **Key Type (`string`)**: Represents the unique session identifier.
    - **Value Type (`int`)**: Represents the count of occurrences for each session.
    - **Store Name (`"SessionCountStore"`)**: Identifier for the state store.

2. **Stream Configuration**:
    ```csharp
    var stream = StreamBuilder<string, string>.CreateNewStream("SessionStream")
        .Stream()
        .Aggregate(
            keySelector: sessionId => sessionId,                      
            aggregateFunction: (currentCount, sessionId) => currentCount + 1,
            stateStoreName: "SessionCountStore",
            stateStore: sessionCountStore
        )
        .Sink(msg => Console.WriteLine($"Message processed: {msg}"))
        .Build();
    ```
    - **Aggregate Operator**:
        - **Key Selector**: Groups data by each unique session ID.
        - **Aggregation Function**: Increments the count for each occurrence.
        - **State Store**: Utilizes the in-memory `sessionCountStore` to manage counts.

3. **Data Emission**:
    ```csharp
    var sessions = new[] { "SessionA", "SessionB", "SessionA", "SessionC", "SessionB", "SessionA" };
    foreach (var session in sessions)
    {
        stream.Emit(session);
    }
    ```
    - Emits a series of session IDs into the stream, triggering the aggregation.

4. **Stream Lifecycle Management**:
    ```csharp
    stream.Start();
    // Emit data...
    stream.Stop();
    ```
    - **Start**: Initiates the stream processing.
    - **Stop**: Gracefully stops the stream, ensuring all data is processed.

**Key Points**:
- **State Persistence**: Unlike `RocksDbStateStore`, the `InMemoryStateStore` does not persist data. All counts are lost when the application stops.
- **Performance**: In-memory state stores offer faster access times, beneficial for high-speed data processing where persistence is not required.
- **Resource Utilization**: Ensure that the application has sufficient memory to handle the expected volume of state data, especially in high-throughput scenarios.