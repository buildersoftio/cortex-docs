---
title: Sink Operators
description: How to use Sink Operators in Cortex.Streams
---

Sink operators are terminal points in the stream processing pipeline that consume and handle the processed data. They can output data to various destinations such as the console, external messaging systems, databases, or other storage solutions.

## Console Sink Operator

**Description and Use Cases**\
The **Console Sink Operator** is the simplest sink operator that outputs data directly to the console. It's primarily used for debugging, logging, or simple monitoring of stream outputs during development.

**Use Cases:**

- **Debugging**: Inspecting data as it flows through the stream.
- **Monitoring**: Viewing real-time outputs for quick insights.
- **Testing**: Verifying the behavior of stream operators without external dependencies.

**Implementation Guide**\
To implement the **Console Sink Operator**, follow these steps:

1. **Define the Sink Action**:
   - Specify the action to perform on each data item (e.g., writing to the console).
2. **Integrate the Operator into the Stream**:
   - Use the Sink method provided by the StreamBuilder to add the operator to the pipeline.
3. **Handle Telemetry (Optional)**:
   - Configure telemetry to monitor sink processing metrics and performance.

**Code Example**
The following example demonstrates the **Console Sink Operator** by outputting transformed data to the console.

```csharp
using Cortex.Streams;
using System;

class Program
{
    static void Main(string[] args)
    {
        // Create and configure the stream with a Map operator and Console Sink
        var stream = StreamBuilder<string>.CreateNewStream("ConsoleSinkStream")
            .Stream()
            .Map(message => $"Processed Message: {message.ToUpper()}") // Transform message to uppercase
            .Sink(Console.WriteLine)                                    // Output to console
            .Build();

        // Start the stream
        stream.Start();

        // Emit data into the stream
        stream.Emit("hello");
        stream.Emit("world");
        stream.Emit("cortex streaming");

        // Stop the stream after processing
        stream.Stop();
    }
}
```
*Output:*

```bash
Processed Message: HELLO
Processed Message: WORLD
Processed Message: CORTEX STREAMING
```