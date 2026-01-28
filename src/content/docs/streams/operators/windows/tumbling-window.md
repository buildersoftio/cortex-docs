---
title: Tumbling Window
description: Tumbling Window in Cortex.Streams
---


A **Tumbling Window** divides a continuous data stream into fixed-size, non-overlapping time intervals. Each event belongs to exactly one window, making tumbling windows ideal for periodic aggregations like hourly reports or daily summaries.

```
Time:     |----Window 1----|----Window 2----|----Window 3----|
Events:   * * *  *    *     * *   *     *    *  *  *   * *
          ??????5 min?????????????5 min?????????????5 min???????
```

## When to Use Tumbling Windows

? **Good for:**
- Periodic reporting (hourly, daily, weekly)
- Batch aggregations
- Non-overlapping time-based metrics
- Event counting per time period

? **Not ideal for:**
- Smooth trend analysis (use Sliding Window)
- Activity-based grouping (use Session Window)

## Basic Usage

### Simple Tumbling Window

```csharp
using Cortex.Streams;
using Cortex.Streams.Operators.Windows;

public record Order(string CustomerId, decimal Amount, DateTime OrderTime);

var stream = StreamBuilder<Order>
    .CreateNewStream("Order Analytics")
    .Stream()
    .TumblingWindow<string>(
        keySelector: order => order.CustomerId,
        timestampSelector: order => order.OrderTime,
        windowSize: TimeSpan.FromHours(1))
    .Map(windowResult => new
    {
        CustomerId = windowResult.Key,
        TotalSpent = windowResult.Items.Sum(o => o.Amount),
        OrderCount = windowResult.Items.Count,
        WindowStart = windowResult.WindowStart,
        WindowEnd = windowResult.WindowEnd
    })
    .Sink(summary => Console.WriteLine(
        $"Customer {summary.CustomerId}: ${summary.TotalSpent:F2} " +
        $"({summary.OrderCount} orders) [{summary.WindowStart:HH:mm}-{summary.WindowEnd:HH:mm}]"))
    .Build();

stream.Start();
```

### Real-World Example: Website Traffic Analysis

```csharp
public record PageView(string PageUrl, string UserId, DateTime Timestamp, string Country);

var trafficStream = StreamBuilder<PageView>
    .CreateNewStream("Traffic Analytics")
    .Stream()
    // Group page views into 15-minute windows by page URL
    .TumblingWindow<string>(
        keySelector: pv => pv.PageUrl,
        timestampSelector: pv => pv.Timestamp,
        windowSize: TimeSpan.FromMinutes(15))
    .Map(window => new PageTrafficSummary
    {
        PageUrl = window.Key,
        ViewCount = window.Items.Count,
        UniqueVisitors = window.Items.Select(pv => pv.UserId).Distinct().Count(),
        TopCountries = window.Items
            .GroupBy(pv => pv.Country)
            .OrderByDescending(g => g.Count())
            .Take(3)
            .Select(g => g.Key)
            .ToList(),
        WindowStart = window.WindowStart,
        WindowEnd = window.WindowEnd
    })
    .Sink(SaveToDatabase)
    .Build();
```

### Real-World Example: IoT Sensor Monitoring

```csharp
public record SensorReading(
    string SensorId, 
    double Temperature, 
    double Humidity, 
    DateTime Timestamp);

var sensorStream = StreamBuilder<SensorReading>
    .CreateNewStream("IoT Monitor")
    .Stream()
    // Filter out invalid readings
    .Filter(r => r.Temperature > -50 && r.Temperature < 150)
    // 1-minute tumbling windows per sensor
    .TumblingWindow<string>(
        keySelector: r => r.SensorId,
        timestampSelector: r => r.Timestamp,
        windowSize: TimeSpan.FromMinutes(1))
    .Map(window => new SensorSummary
    {
        SensorId = window.Key,
        AvgTemperature = window.Items.Average(r => r.Temperature),
        MaxTemperature = window.Items.Max(r => r.Temperature),
        MinTemperature = window.Items.Min(r => r.Temperature),
        AvgHumidity = window.Items.Average(r => r.Humidity),
        ReadingCount = window.Items.Count,
        Timestamp = window.WindowEnd
    })
    // Alert if temperature exceeds threshold
    .Filter(summary => summary.MaxTemperature > 80)
    .Sink(alert => SendAlert($"High temperature alert for sensor {alert.SensorId}!"))
    .Build();
```

## Advanced Tumbling Window

For more control over window behavior, use `AdvancedTumblingWindow`:

### With Count-Based Trigger

Emit results every N elements instead of waiting for the window to close:

```csharp
var config = WindowConfiguration<Order>.Create()
    .TriggerOnCount(100)  // Fire every 100 orders
    .Build();

var stream = StreamBuilder<Order>
    .CreateNewStream("Fast Order Processing")
    .Stream()
    .AdvancedTumblingWindow<string>(
        keySelector: o => o.CustomerId,
        timestampSelector: o => o.OrderTime,
        windowSize: TimeSpan.FromHours(1),
        config: config)
    .Map(ProcessWindowResult)
    .Build();
```

### With Early Results

Get partial results before the window closes:

```csharp
var config = WindowConfiguration<SensorReading>.Create()
    .WithEarlyTrigger(TimeSpan.FromSeconds(10))  // Early results every 10 seconds
    .WithStateMode(WindowStateMode.Accumulating)  // Include all data in each emission
    .Build();

var stream = StreamBuilder<SensorReading>
    .CreateNewStream("Real-time Sensor Monitor")
    .Stream()
    .AdvancedTumblingWindow<string>(
        keySelector: r => r.SensorId,
        timestampSelector: r => r.Timestamp,
        windowSize: TimeSpan.FromMinutes(5),
        config: config)
    .Map(window =>
    {
        var prefix = window.IsFinal ? "FINAL" : "PARTIAL";
        return $"[{prefix}] Sensor {window.Key}: " +
               $"Avg={window.Items.Average(r => r.Temperature):F1}�C " +
               $"({window.Items.Count} readings)";
    })
    .Sink(Console.WriteLine)
    .Build();
```

### Handling Late Data

Allow late-arriving events to be included in closed windows:

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithAllowedLateness(TimeSpan.FromMinutes(5))  // Accept data up to 5 min late
    .OnLateEvent((evt, timestamp) => 
        Console.WriteLine($"Late event dropped: {evt} at {timestamp}"))
    .Build();

var stream = StreamBuilder<Event>
    .CreateNewStream("Late Data Handler")
    .Stream()
    .AdvancedTumblingWindow<string>(
        keySelector: e => e.Key,
        timestampSelector: e => e.Timestamp,
        windowSize: TimeSpan.FromMinutes(10),
        config: config)
    .Build();
```

## State Modes

Control how window state is managed across multiple emissions:

### Discarding Mode (Default)
Each emission only includes elements since the last firing:

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithStateMode(WindowStateMode.Discarding)
    .TriggerOnCount(50)
    .Build();

// Emissions: [1-50], [51-100], [101-150]...
```

### Accumulating Mode
Each emission includes ALL elements since window start:

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithStateMode(WindowStateMode.Accumulating)
    .TriggerOnCount(50)
    .Build();

// Emissions: [1-50], [1-100], [1-150]...
```

### Accumulating and Retracting Mode
Emits retractions for previous results when updated results are available:

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithStateMode(WindowStateMode.AccumulatingAndRetracting)
    .WithEarlyTrigger(TimeSpan.FromSeconds(30))
    .Build();

// Emissions: 
// [1-50] (Early)
// RETRACT [1-50]
// [1-100] (Early)
// RETRACT [1-100]
// [1-150] (Final)
```

## Using Custom State Stores

### In-Memory Store (Default)

```csharp
// Automatically created if not specified
var stream = StreamBuilder<Event>
    .CreateNewStream("Demo")
    .Stream()
    .TumblingWindow<string>(
        keySelector: e => e.Key,
        timestampSelector: e => e.Timestamp,
        windowSize: TimeSpan.FromMinutes(5))
    .Build();
```

### Named State Store

```csharp
var stream = StreamBuilder<Event>
    .CreateNewStream("Demo")
    .Stream()
    .TumblingWindow<string>(
        keySelector: e => e.Key,
        timestampSelector: e => e.Timestamp,
        windowSize: TimeSpan.FromMinutes(5),
        stateStoreName: "my-tumbling-window-store")
    .Build();
```

### Custom Persistent Store

```csharp
var rocksDbStore = new RocksDbStateStore<string, List<Order>>(
    path: "./window-state/orders",
    name: "order-windows");

var stream = StreamBuilder<Order>
    .CreateNewStream("Persistent Orders")
    .Stream()
    .TumblingWindow<string>(
        keySelector: o => o.CustomerId,
        timestampSelector: o => o.OrderTime,
        windowSize: TimeSpan.FromHours(1),
        stateStore: rocksDbStore)
    .Build();
```

## Complete Example: Financial Transaction Monitoring

```csharp
using Cortex.Streams;
using Cortex.Streams.Operators.Windows;
using Cortex.States;

public record Transaction(
    string AccountId,
    decimal Amount,
    string Type,  // "credit" or "debit"
    DateTime Timestamp);

public record AccountSummary(
    string AccountId,
    decimal TotalCredits,
    decimal TotalDebits,
    decimal NetChange,
    int TransactionCount,
    DateTime WindowStart,
    DateTime WindowEnd,
    bool IsSuspicious);

public class TransactionMonitor
{
    public void Start()
    {
        // Configuration for early alerts
        var config = WindowConfiguration<Transaction>.Create()
            .WithEarlyTrigger(TimeSpan.FromMinutes(1))
            .WithStateMode(WindowStateMode.Accumulating)
            .WithAllowedLateness(TimeSpan.FromMinutes(2))
            .OnLateEvent((txn, ts) => LogLateTransaction(txn, ts))
            .Build();

        var stream = StreamBuilder<Transaction>
            .CreateNewStream("Transaction Monitor")
            .Stream()
            // 5-minute tumbling windows per account
            .AdvancedTumblingWindow<string>(
                keySelector: t => t.AccountId,
                timestampSelector: t => t.Timestamp,
                windowSize: TimeSpan.FromMinutes(5),
                config: config)
            .Map(window =>
            {
                var credits = window.Items.Where(t => t.Type == "credit").Sum(t => t.Amount);
                var debits = window.Items.Where(t => t.Type == "debit").Sum(t => t.Amount);
                
                return new AccountSummary(
                    AccountId: window.Key,
                    TotalCredits: credits,
                    TotalDebits: debits,
                    NetChange: credits - debits,
                    TransactionCount: window.Items.Count,
                    WindowStart: window.WindowStart,
                    WindowEnd: window.WindowEnd,
                    // Flag as suspicious if high volume of transactions
                    IsSuspicious: window.Items.Count > 50 || debits > 10000);
            })
            .AddBranch("Alerts", branch => branch
                .Filter(s => s.IsSuspicious)
                .Sink(SendFraudAlert))
            .Sink(SaveToDatabase)
            .Build();

        stream.Start();
    }

    private void SendFraudAlert(AccountSummary summary)
    {
        Console.WriteLine($"?? ALERT: Suspicious activity on account {summary.AccountId}");
        Console.WriteLine($"   Transactions: {summary.TransactionCount}");
        Console.WriteLine($"   Total Debits: ${summary.TotalDebits:F2}");
    }

    private void SaveToDatabase(AccountSummary summary)
    {
        // Save to your database
    }

    private void LogLateTransaction(Transaction txn, DateTime timestamp)
    {
        Console.WriteLine($"Late transaction dropped: {txn.AccountId} at {timestamp}");
    }
}
```

## Best Practices

1. **Choose appropriate window sizes**: Balance between granularity and performance
2. **Use state stores for fault tolerance**: Persist window state for recovery
3. **Handle late data**: Configure `AllowedLateness` based on your data characteristics
4. **Use early triggers for long windows**: Don't make users wait for 1-hour windows
5. **Monitor memory usage**: Large windows with many keys can consume significant memory
