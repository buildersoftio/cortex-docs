---
title: Window Operators Overview
description: Window Operators Overview in Cortex.Streams
---

Windowing is a fundamental concept in stream processing that allows you to group and aggregate unbounded streams of data into finite, manageable chunks. Cortex.Streams provides a comprehensive windowing system that enables real-time analytics, aggregations, and event processing.

## Why Use Windows?

In stream processing, data flows continuously and indefinitely. Windows help you:

- **Aggregate data over time**: Calculate metrics like sums, averages, and counts for specific time periods
- **Detect patterns**: Identify trends or anomalies within bounded time frames
- **Reduce memory usage**: Process data in chunks rather than keeping all data in memory
- **Generate timely insights**: Emit results at regular intervals or when specific conditions are met

## Window Types in Cortex.Streams

Cortex.Streams supports three fundamental window types:

| Window Type | Description | Use Case |
|-------------|-------------|----------|
| **Tumbling Window** | Fixed-size, non-overlapping windows | Hourly/daily reports, batch aggregations |
| **Sliding Window**  | Fixed-size, overlapping windows | Moving averages, trend detection |
| **Session Window** | Dynamic windows based on activity gaps | User session analysis, activity tracking |

## Basic vs Advanced Windows

Each window type comes in two variants:

### Basic Windows
Simple window operations with automatic triggering at window end:
- `TumblingWindow<TKey>(...)`
- `SlidingWindow<TKey>(...)`
- `SessionWindow<TKey>(...)`

### Advanced Windows
Full control over triggers, state modes, and late data handling:
- `AdvancedTumblingWindow<TKey>(...)`
- `AdvancedSlidingWindow<TKey>(...)`
- `AdvancedSessionWindow<TKey>(...)`

## Quick Example

```csharp
using Cortex.Streams;
using Cortex.Streams.Operators.Windows;
using Cortex.States;

// Define a simple event
public record SensorReading(string SensorId, double Temperature, DateTime Timestamp);

// Create a stream with a 5-minute tumbling window
var stream = StreamBuilder<SensorReading>
    .CreateNewStream("Temperature Monitor")
    .Stream()
    .TumblingWindow<string>(
        keySelector: reading => reading.SensorId,
        timestampSelector: reading => reading.Timestamp,
        windowSize: TimeSpan.FromMinutes(5))
    .Map(windowResult => new
    {
        SensorId = windowResult.Key,
        AverageTemp = windowResult.Items.Average(r => r.Temperature),
        WindowStart = windowResult.WindowStart,
        WindowEnd = windowResult.WindowEnd
    })
    .Sink(result => Console.WriteLine(
        $"Sensor {result.SensorId}: Avg Temp = {result.AverageTemp:F2}°C " +
        $"[{result.WindowStart:HH:mm} - {result.WindowEnd:HH:mm}]"))
    .Build();

stream.Start();
```

## Window Result Structure

All windows emit `WindowResult<TKey, TValue>` objects containing:

```csharp
public class WindowResult<TKey, TValue>
{
    public TKey Key { get; }                    // Partition key
    public DateTime WindowStart { get; }        // Window start time
    public DateTime WindowEnd { get; }          // Window end time
    public IReadOnlyList<TValue> Items { get; } // Items in the window
    public WindowEmissionType EmissionType { get; } // Early, OnTime, Late, or Retraction
    public bool IsFinal { get; }                // True if window is closed
    public DateTime EmissionTime { get; }       // When result was emitted
    public int EmissionSequence { get; }        // Emission counter for updates
}
```

## Key Concepts

### Key Selector
Determines how data is partitioned into separate windows:

```csharp
// Separate windows per sensor
keySelector: reading => reading.SensorId

// Separate windows per user
keySelector: event => event.UserId

// Global window (single partition)
keySelector: _ => "global"
```

### Timestamp Selector
Extracts the event time used for window assignment:

```csharp
// Use event's timestamp
timestampSelector: reading => reading.Timestamp

// Use current time (processing time)
timestampSelector: _ => DateTime.UtcNow
```

### State Stores
Windows use state stores to maintain data between events:

```csharp
// In-memory store (default)
var store = new InMemoryStateStore<string, List<SensorReading>>();

// Or use persistent stores like RocksDB
var rocksStore = new RocksDbStateStore<string, List<SensorReading>>(
    path: "./window-state",
    name: "temperature-windows");
```