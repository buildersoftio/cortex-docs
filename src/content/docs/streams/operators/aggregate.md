---
title: Aggregate Operators
description: How to use Aggregate Operators in Cortex.Streams
---

## Description and Use Cases

The **Aggregate Operator** performs aggregation operations on data items grouped by a key. It maintains and updates an aggregate value for each key based on incoming data, enabling cumulative computations such as sums, averages, or custom aggregations.

**Use Cases:**
- **Counting**: Tracking the number of occurrences of each key.
- **Summation**: Calculating the total sum of values per key.
- **Averaging**: Computing the average value per key.
- **Custom Aggregations**: Implementing complex aggregation logic tailored to specific requirements.

## Implementation Guide

To implement the **Aggregate Operator**, follow these steps:

1. **Define the Key Selector and Aggregation Function:**
   - **Key Selector**: Determines how to group data items.
   - **Aggregation Function**: Defines how to update the aggregate value based on incoming data.
2. **Configure the State Store:**
   - Use a state store (e.g., `RocksDbStateStore`) to maintain aggregate states.
3. **Integrate the Operator into the Stream:**
   - Use the `Aggregate` method provided by the `StreamBuilder` to add the operator to the pipeline.
4. **Handle Telemetry (Optional):**
   - Configure telemetry to monitor aggregation metrics and performance.

## Code Example

The following example demonstrates the Aggregate Operator by counting the number of occurrences of each word in a stream of strings.

```csharp
using Cortex.States.RocksDb;
using Cortex.Streams;
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
            .AggregateSilently(
                keySelector: word => word,                     // Group by the word itself
                aggregateFunction: (currentCount, word) => currentCount + 1, // Increment count
                stateStoreName: "WordCountStore",
                stateStore: wordCountStore
            )
            .Sink(msg => Console.WriteLine($"Word: {msg}, processed")) // Output word counts
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
    }
}
```

**Explanation:**

1. **State Store Initialization**: A `RocksDbStateStore` named `"WordCountStore"` is initialized to persist word counts.
2. **Stream Configuration**:
   - **Aggregate Operator**: Groups incoming words and increments their counts.
3. **Data Emission**: The stream processes the words, updating counts accordingly.
4. **Stream Lifecycle**: The stream is started, data is emitted, and then the stream is stopped.