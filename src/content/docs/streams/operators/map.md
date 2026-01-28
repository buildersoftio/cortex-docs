---
title: Map Operators
description: How to use Map Operators in Cortex.Streams
---

## Description and Use Cases

The **Map Operator** is a fundamental transform operator that applies a specified transformation function to each data item in the stream. It transforms data from one type to another, enabling developers to modify, enrich, or reformat data as it flows through the pipeline.

**Use Cases:**
- **Data Transformation**: Converting data from one format to another (e.g., integers to strings).
- **Enrichment**: Adding additional information to data items (e.g., appending metadata).
- **Computation**: Performing calculations on data items (e.g., multiplying numbers).

## Implementation Guide

To implement the **Map Operator**, follow these steps:

1. **Define the Transformation Function**: Specify how each data item should be transformed.
2. **Integrate the Operator into the Stream**: Use the Map method provided by the StreamBuilder to add the operator to the pipeline.
3. **Handle Telemetry (Optional)**: Configure telemetry to monitor the operator's performance.

## Code Example
Below is a code example demonstrating the usage of the Map Operator within a stream that processes integer values by doubling them and then outputs the results to the console.

```csharp
using Cortex.Streams;
using System;

class Program
{
    static void Main(string[] args)
    {
        // Create and configure the stream with a Map operator
        var stream = StreamBuilder<int>.CreateNewStream("DoubleStream")
            .Stream()
            .Map(x => x * 2)                  // Transform each integer by doubling it
            .Sink(x => Console.WriteLine(x))  // Output the transformed data to the console
            .Build();

        // Start the stream
        stream.Start();

        // Emit data into the stream
        for (int i = 1; i <= 5; i++)
        {
            stream.Emit(i);  // Outputs: 2, 4, 6, 8, 10
        }

        // Stop the stream after processing
        stream.Stop();
    }
}
```
*Output:*

```csharp
2
4
6
8
10
```
