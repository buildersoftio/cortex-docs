---
title: Filter Operators
description: How to use Filter Operators in Cortex.Streams
---

## Description and Use Cases

The **Filter Operator** is used to selectively allow data items to pass through the stream based on a specified condition or predicate. It evaluates each data item and only forwards those that meet the criteria defined by the predicate function.

**Use Cases:**
- **Data Validation**: Excluding invalid or malformed data items.
- **Conditional Processing**: Processing only data items that meet certain conditions.
- **Reducing Noise**: Filtering out irrelevant or unnecessary data to focus on meaningful information.

## Implementation Guide

To implement the **Filter Operator**, follow these steps:

1. **Define the Predicate Function**: Specify the condition that determines whether a data item should pass through.
2. **Integrate the Operator into the Stream**: Use the `Filter` method provided by the `StreamBuilder` to add the operator to the pipeline.
3. **Handle Telemetry (Optional)**: Configure telemetry to monitor the operator's performance and filter outcomes.

## Code Example
The following example demonstrates the **Filter Operator** in action. It filters out even numbers from a stream of integers, allowing only odd numbers to pass through and be printed to the console.

```csharp
using Cortex.Streams;
using System;

class Program
{
    static void Main(string[] args)
    {
        // Create and configure the stream with a Filter operator
        var stream = StreamBuilder<int, int>.CreateNewStream("OddNumberStream")
            .Stream()
            .Filter(x => x % 2 != 0)           // Allow only odd numbers
            .Sink(x => Console.WriteLine(x))  // Output the filtered data to the console
            .Build();

        // Start the stream
        stream.Start();

        // Emit data into the stream
        for (int i = 1; i <= 10; i++)
        {
            stream.Emit(i);  // Outputs: 1, 3, 5, 7, 9
        }

        // Stop the stream after processing
        stream.Stop();
    }
}
```

*Output:*

```csharp
1
3
5
7
9
```
