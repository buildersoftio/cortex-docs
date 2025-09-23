---
title: Custom Operators
description: How to use Custom Operators in Cortex.Streams
---

While Cortex provides a variety of built-in operators, developers can create custom operators to extend the platform's functionality and cater to specific processing needs.

## Creating Custom Operators

To create a custom operator, follow these steps:
1. **Implement the `IOperator` Interface**:
   - Define the processing logic by implementing the `Process` and `SetNext` methods.
2. **Optionally Implement `IStatefulOperator`**:
   - If the operator needs to maintain state, implement the `IStatefulOperator` interface.
3. **Optionally Implement `ITelemetryEnabled`**:
   - For telemetry integration, implement the `ITelemetryEnabled` interface.
4. **Integrate the Custom Operator into the Stream**:
   - Use the `Map`, `Filter`, or other relevant methods to add the custom operator to the pipeline.

## Code Example: Custom Logging Operator
The following example demonstrates creating a custom operator that logs each data item processed.

```csharp
using Cortex.Streams.Operators;
using Cortex.Telemetry;
using System;

public class LoggingOperator<T> : IOperator, ITelemetryEnabled
{
    private IOperator _nextOperator;
    private ITelemetryProvider _telemetryProvider;
    private ICounter _logCounter;

    public void SetTelemetryProvider(ITelemetryProvider telemetryProvider)
    {
        _telemetryProvider = telemetryProvider;
        if (_telemetryProvider != null)
        {
            var metrics = _telemetryProvider.GetMetricsProvider();
            _logCounter = metrics.CreateCounter($"logging_operator_processed_{typeof(T).Name}", "Number of items processed by LoggingOperator");
        }
    }

    public void Process(object input)
    {
        T data = (T)input;
        Console.WriteLine($"LoggingOperator: Processing data - {data}");

        _logCounter?.Increment();

        _nextOperator?.Process(input);
    }

    public void SetNext(IOperator nextOperator)
    {
        _nextOperator = nextOperator;
        if (_nextOperator is ITelemetryEnabled telemetryEnabled)
        {
            telemetryEnabled.SetTelemetryProvider(_telemetryProvider);
        }
    }
}
```

**Integrating the Custom Operator:**
```csharp
using Cortex.Streams;
using Cortex.Streams.Extensions;       // Namespace where StreamBuilderExtensions is defined
using System;

class Program
{
    static void Main(string[] args)
    {
        // Initialize the custom logging operator
        var loggingOperator = new LoggingOperator<string>();

        // Create and configure the stream with Map, LoggingOperator, and Sink using the extension method
        var stream = StreamBuilder<string, string>.CreateNewStream("CustomOperatorStream")
            .Stream()
            .Map(message => $"Transformed: {message}")                // Example transformation
            .UseOperator<string, string, string>(loggingOperator)      // Add custom LoggingOperator
            .Sink(x => Console.WriteLine(x))                           // Sink to console
            .Build();

        // Start the stream
        stream.Start();

        // Emit data into the stream
        stream.Emit("CustomEvent1");
        stream.Emit("CustomEvent2");

        // Stop the stream after processing
        stream.Stop();
    }
}
```

*Output:*
```csharp
LoggingOperator: Processing data - Transformed: CustomEvent1
Transformed: CustomEvent1
LoggingOperator: Processing data - Transformed: CustomEvent2
Transformed: CustomEvent2
```

**Explanation:**

1. **Custom Operator Definition**: The `LoggingOperator` logs each data item it processes and increments a telemetry counter.
2. **Stream Configuration**:
   - **Map Operator**: Transforms incoming messages.
   - **Custom Logging Operator**: Logs the transformed messages.
   - **Sink Operator**: Outputs the final data to the console.
3. **Data Emission**: Emits two custom events that pass through the transformation, logging, and sink stages.
4. **Stream Lifecycle**: The stream is started, data is emitted and processed, and then the stream is stopped.