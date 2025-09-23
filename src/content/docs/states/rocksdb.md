---
title: RocksDB Store
description: An overview of Cortex RocksDb Store
---

The RocksDbStateStore is a robust, persistent key-value store built on [RocksDB](https://rocksdb.org/), a high-performance embedded database for fast storage environments. It is designed to handle large volumes of data with low latency, making it ideal for stateful stream processing tasks that require durability and scalability.

### Description and Features

**RocksDbStateStore** offers the following features:

- **Persistent Storage**: Ensures that state data is stored on disk, providing durability across application restarts and failures.
- **High Performance**: Optimized for fast read and write operations, suitable for high-throughput streaming applications.
- **Key-Value Storage**: Utilizes a simple key-value paradigm, allowing easy integration with various operators.
- **Configurable Options**: Offers numerous configuration settings to fine-tune performance, storage paths, compaction strategies, and more.
- **Thread-Safe**: Supports concurrent access, enabling multiple operators to interact with the state store simultaneously.
- **Snapshots and Iterators**: Provides mechanisms to create snapshots of the state and iterate over key-value pairs for advanced operations.

**Benefits**:

- **Durability**: Guarantees that state data is not lost in the event of system crashes or restarts.
- **Scalability**: Capable of handling extensive state data, making it suitable for large-scale applications.
- **Flexibility**: Supports various data types and complex state management scenarios through customizable key and value schemas.

### Configuration and Setup

To utilize the **RocksDbStateStore**, follow these configuration and setup steps:

**Prerequisites**:

- **RocksDB Dependency**: Ensure that the RocksDB library is included in your project. You can add it via NuGet:
    ```shell
        Install-Package Cortex.States.RocksDb
    ```
- **Directory Permissions**: Verify that the application has read and write permissions to the designated **RocksDB** storage directory.

**Step-by-Step Configuration:**

1. **Define the Key and Value Types**:\
Determine the data types for the keys and values you intend to store. Typically, keys are strings or composite identifiers, and values can be simple types or complex objects serialized into byte arrays.

2. **Initialize the RocksDbStateStore**:\
Create an instance of the `RocksDbStateStore<TKey, TValue>` by specifying the store name and storage path.
    ```csharp
    using Cortex.States.RocksDb;
    using System;

    // Initialize a RocksDbStateStore for storing word counts
    var wordCountStore = new RocksDbStateStore<string, int>("WordCountStore", "/path/to/rocksdb");
    ```

3. **Configure RocksDB Options (Optional)**:\
Customize **RocksDB** settings to optimize performance based on your application's requirements.

    ```csharp
    using RocksDbSharp;

    var options = new DbOptions()
        .SetCreateIfMissing(true)
        .SetMaxOpenFiles(-1) // Unlimited open files
        .SetAllowMmapReads(true)
        .SetAllowMmapWrites(true)
        .SetIncreaseParallelism(Environment.ProcessorCount)
        .SetUseFsync(false);

    // Pass options to the RocksDbStateStore constructor if supported
    var wordCountStore = new RocksDbStateStore<string, int>("WordCountStore", "/path/to/rocksdb", options);
    ```
4. **Handle State Store Lifecycle**:\
Ensure proper disposal of the state store to release resources and flush any pending writes.
    ```csharp
    wordCountStore.Dispose();
    ```

> **Note**: The actual implementation details may vary based on the `RocksDbStateStore` class's constructor and configuration options. *Always refer to the official documentation or source code for precise configuration parameters*.

### Usage Guide
The **RocksDbStateStore** is used to persist state information required by stateful operators such as aggregations and windowing. Here's how to effectively use it within your stream processing pipeline:

1. **Integration with StreamBuilder**:\
When building a stream that requires stateful operations, pass the `RocksDbStateStore` instance to the relevant operators.

2. **Stateful Operators Configuration**:\
Operators like `AggregateOperator` or `TumblingWindowOperator` will utilize the state store to maintain and update state across data items.

3. **State Management**:
   - Putting Data: Use the `Put` method to insert or update key-value pairs in the state store.
   - **Getting Data**: Retrieve data using the `Get` method based on keys.
   - **Removing Data**: Use the `Remove` method to delete specific entries from the state store.
   - **Iterating Over Data**: Some state stores support iterators to traverse key-value pairs for comprehensive state management.

4. **Handling Failures**:\
Since **RocksDbStateStore** persists data on disk, it ensures that state is recoverable after failures. Upon restarting the stream, operators can reinitialize their state from the persisted data, maintaining continuity in processing.

5. **Performance Considerations**:
   - **Storage Path**: Choose a fast and reliable storage medium (e.g., SSDs) for the RocksDB storage directory to maximize performance.
   - **Configuration Tuning**: Adjust RocksDB options to balance between read/write performance and resource utilization based on your application's workload.

### Code Example
Below is a practical code example demonstrating the usage of **RocksDbStateStore** within a stream that counts word occurrences using the `AggregateOperator`. The example illustrates initializing the state store, configuring the stream with aggregation, and handling state persistence.

```csharp
using Cortex.States.RocksDb;
using Cortex.Streams;
using Cortex.Streams.Operators;
using System;

class Program
{
    static void Main(string[] args)
    {
        // Initialize a RocksDbStateStore for word counts
        var wordCountStore = new RocksDbStateStore<string, int>("WordCountStore", "/path/to/rocksdb");

        // Create and configure the stream with an Aggregate operator
        var stream = StreamBuilder<string, string>.CreateNewStream("WordCountStream")
            .Stream()
            .Aggregate(
                keySelector: word => word,                       // Group by the word itself
                aggregateFunction: (currentCount, word) => currentCount + 1, // Increment count
                stateStoreName: "WordCountStore",
                stateStore: wordCountStore
            )
            .Sink(msg => Console.WriteLine($"Word processed: {msg}"))
            .Build();

        // Start the stream
        stream.Start();

        // Emit data into the stream
        var words = new[] { "apple", "banana", "apple", "orange", "banana", "apple" };
        foreach (var word in words)
        {
            stream.Emit(word);
        }

        // Stop the stream after processing
        stream.Stop();

        // Dispose the state store to release resources
        wordCountStore.Dispose();
    }
}
```

**Explanation**:

1. **State Store Initialization**:
    ```csharp
    var wordCountStore = new RocksDbStateStore<string, int>("WordCountStore", "/path/to/rocksdb");
    ```

    - **Key Type** (`string`): Represents the word being counted.
    - **Value Type** (`int`): Represents the count of occurrences for each word.
    - **Store Name** (`"WordCountStore"`): Identifier for the state store.
    - **Storage Path** (`"/path/to/rocksdb"`): Directory where RocksDB stores data.

2. **Stream Configuration**:
    ```csharp
    var stream = StreamBuilder<string, string>.CreateNewStream("WordCountStream")
        .Stream()
        .Aggregate(
            keySelector: word => word,                       
            aggregateFunction: (currentCount, word) => currentCount + 1,
            stateStoreName: "WordCountStore",
            stateStore: wordCountStore
        )
        .Sink(msg => Console.WriteLine($"Word processed: {msg}"))
        .Build();

    ```
    - **Aggregate Operator**:
        - **Key Selector**: Groups data by each unique word.
        - **Aggregation Function**: Increments the count for each occurrence.
        - **State Store**: Utilizes the previously initialized `wordCountStore` to persist counts.

3. **Data Emission**:
    ```csharp
    var words = new[] { "apple", "banana", "apple", "orange", "banana", "apple" };
    foreach (var word in words)
    {
        stream.Emit(word);
    }
    ```
    - Emits a series of words into the stream, triggering the aggregation.

4. **Stream Lifecycle Management**:
    ```csharp
    stream.Start();
    // Emit data...
    stream.Stop();
    wordCountStore.Dispose();
    ```
    - **Start**: Initiates the stream processing.
    - **Stop**: Gracefully stops the stream, ensuring all data is processed.
    - **Dispose**: Releases resources held by the state store.


**Key Points:**
- **State Persistence**: The `RocksDbStateStore` ensures that word counts are persisted, allowing the stream to recover counts in case of failures or restarts.
- **Thread Safety**: Multiple operators can safely interact with the state store concurrently.
- **Resource Management**: Proper disposal of the state store is crucial to prevent resource leaks and ensure data integrity.
