---
title: Advanced Window Configuration
description: Advanced Window Configuration in Cortex.Streams
---


# Advanced Window Configuration

## Overview

Advanced window configuration in Cortex.Streams provides fine-grained control over window behavior including state management, late data handling, and emission policies. This guide covers all advanced configuration options.

## WindowConfiguration Builder

The `WindowConfiguration<TInput>` class uses a fluent builder pattern:

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithTrigger(trigger)
    .WithStateMode(WindowStateMode.Accumulating)
    .WithAllowedLateness(TimeSpan.FromMinutes(5))
    .OnLateEvent((evt, ts) => HandleLateEvent(evt, ts))
    .Build();
```

## Configuration Options

### Triggers

Control when windows emit results:

```csharp
// Event time trigger (default) - fires at window end
.WithTrigger(new EventTimeTrigger<Event>())

// Count-based trigger
.TriggerOnCount(100)

// Processing time trigger
.TriggerOnProcessingTime(TimeSpan.FromSeconds(30))

// Early trigger with partial results
.WithEarlyTrigger(TimeSpan.FromMinutes(1))
```

See [Window Triggers](Window-Triggers.md) for detailed trigger documentation.

### State Modes

Control how window state is managed across multiple emissions:

```csharp
.WithStateMode(WindowStateMode.Discarding)        // Default
.WithStateMode(WindowStateMode.Accumulating)
.WithStateMode(WindowStateMode.AccumulatingAndRetracting)
```

### Late Data Handling

Configure handling of events that arrive after their window has closed:

```csharp
.WithAllowedLateness(TimeSpan.FromMinutes(5))
.OnLateEvent((event, timestamp) => LogLateEvent(event, timestamp))
```

## State Modes Deep Dive

### Discarding Mode (Default)

Each emission only includes elements since the last firing. The window state is cleared after each emission.

```
Events:    [A] [B] [C] --- trigger --- [D] [E] --- trigger --- [F] --- window end
Emissions:           [A,B,C]               [D,E]                  [F]
```

**When to use:**
- Incremental/delta processing
- When downstream can handle partial batches
- Low memory scenarios

```csharp
var config = WindowConfiguration<Order>.Create()
    .TriggerOnCount(100)
    .WithStateMode(WindowStateMode.Discarding)
    .Build();

// Processing batches
stream.AdvancedTumblingWindow<string>(
    keySelector: o => o.Region,
    timestampSelector: o => o.OrderTime,
    windowSize: TimeSpan.FromHours(1),
    config: config)
.Map(window => 
{
    // Each emission contains only new orders since last trigger
    Console.WriteLine($"Processing {window.Items.Count} new orders");
    return ProcessBatch(window.Items);
})
.Build();
```

### Accumulating Mode

Each emission includes ALL elements since the window started. Window state accumulates across emissions.

```
Events:    [A] [B] [C] --- trigger --- [D] [E] --- trigger --- [F] --- window end
Emissions:           [A,B,C]           [A,B,C,D,E]             [A,B,C,D,E,F]
```

**When to use:**
- Running totals and aggregates
- Dashboard updates showing cumulative data
- When downstream needs complete picture

```csharp
var config = WindowConfiguration<Metric>.Create()
    .WithEarlyTrigger(TimeSpan.FromSeconds(10))
    .WithStateMode(WindowStateMode.Accumulating)
    .Build();

// Running average
stream.AdvancedTumblingWindow<string>(
    keySelector: m => m.Sensor,
    timestampSelector: m => m.Timestamp,
    windowSize: TimeSpan.FromMinutes(5),
    config: config)
.Map(window =>
{
    // Each emission shows cumulative average
    var avg = window.Items.Average(m => m.Value);
    var status = window.IsFinal ? "FINAL" : "RUNNING";
    return $"[{status}] Sensor {window.Key}: Avg = {avg:F2} ({window.Items.Count} samples)";
})
.Build();
```

### Accumulating and Retracting Mode

Like Accumulating, but also emits retractions for previous results before updated results.

```
Events:    [A] [B] [C] --- trigger --- [D] [E] --- trigger --- window end
Emissions:           [A,B,C]
                     RETRACT[A,B,C]
                            [A,B,C,D,E]
                            RETRACT[A,B,C,D,E]
                                   [A,B,C,D,E] (final)
```

**When to use:**
- Downstream systems need to update/replace previous results
- Real-time dashboards that display and update
- Systems that maintain derived state

```csharp
var config = WindowConfiguration<Transaction>.Create()
    .WithEarlyTrigger(TimeSpan.FromMinutes(1))
    .WithStateMode(WindowStateMode.AccumulatingAndRetracting)
    .Build();

stream.AdvancedTumblingWindow<string>(
    keySelector: t => t.AccountId,
    timestampSelector: t => t.Timestamp,
    windowSize: TimeSpan.FromHours(1),
    config: config)
.Map(window =>
{
    var action = window.EmissionType switch
    {
        WindowEmissionType.Retraction => "DELETE",
        WindowEmissionType.Early => "UPSERT",
        WindowEmissionType.OnTime => "FINAL",
        _ => "UPDATE"
    };
    
    return new DatabaseCommand(
        Action: action,
        Key: $"{window.Key}_{window.WindowStart:yyyyMMddHH}",
        Value: CalculateAggregates(window.Items));
})
.Sink(ExecuteDatabaseCommand)
.Build();
```

## Late Data Handling

### Allowed Lateness

Configures how long after window end to accept late-arriving data:

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithAllowedLateness(TimeSpan.FromMinutes(5))
    .Build();
```

**Timeline:**
```
Window End: 10:00
Allowed Lateness: 5 minutes

10:00 - Window fires (on-time emission)
10:01 - Late event arrives ? Included, triggers late emission
10:04 - Late event arrives ? Included, triggers late emission  
10:06 - Late event arrives ? DROPPED (past allowed lateness)
```

### Late Event Callback

Handle events that arrive too late:

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithAllowedLateness(TimeSpan.FromMinutes(5))
    .OnLateEvent((evt, timestamp) =>
    {
        // Log the late event
        Console.WriteLine($"Late event dropped: {evt} at {timestamp}");
        
        // Optionally store for batch reprocessing
        lateEventStore.Add((evt, timestamp));
        
        // Or send to dead letter queue
        deadLetterQueue.Send(evt);
    })
    .Build();
```

### Complete Late Data Example

```csharp
public class LateTolerantProcessor
{
    private readonly List<(Event Event, DateTime Timestamp)> _lateEvents = new();
    private readonly object _lock = new();

    public void Start()
    {
        var config = WindowConfiguration<Event>.Create()
            .WithAllowedLateness(TimeSpan.FromMinutes(10))
            .OnLateEvent(HandleLateEvent)
            .WithEarlyTrigger(TimeSpan.FromMinutes(1))
            .WithStateMode(WindowStateMode.Accumulating)
            .Build();

        var stream = StreamBuilder<Event>
            .CreateNewStream("Late-Tolerant Processor")
            .Stream()
            .AdvancedTumblingWindow<string>(
                keySelector: e => e.Category,
                timestampSelector: e => e.Timestamp,
                windowSize: TimeSpan.FromMinutes(15),
                config: config)
            .Map(window =>
            {
                var type = window.EmissionType switch
                {
                    WindowEmissionType.Early => "PARTIAL",
                    WindowEmissionType.OnTime => "ON-TIME",
                    WindowEmissionType.Late => "LATE UPDATE",
                    _ => "OTHER"
                };
                
                return new WindowSummary
                {
                    Category = window.Key,
                    EmissionType = type,
                    Count = window.Items.Count,
                    WindowStart = window.WindowStart,
                    WindowEnd = window.WindowEnd,
                    IsFinal = window.IsFinal
                };
            })
            .Sink(ProcessSummary)
            .Build();

        stream.Start();
        
        // Periodically reprocess late events
        StartLateEventReprocessor();
    }

    private void HandleLateEvent(Event evt, DateTime timestamp)
    {
        lock (_lock)
        {
            _lateEvents.Add((evt, timestamp));
            Console.WriteLine($"? Late event queued: {evt.Category} from {timestamp}");
        }
    }

    private void StartLateEventReprocessor()
    {
        Task.Run(async () =>
        {
            while (true)
            {
                await Task.Delay(TimeSpan.FromMinutes(5));
                
                List<(Event, DateTime)> toProcess;
                lock (_lock)
                {
                    toProcess = new List<(Event, DateTime)>(_lateEvents);
                    _lateEvents.Clear();
                }
                
                if (toProcess.Count > 0)
                {
                    Console.WriteLine($"Reprocessing {toProcess.Count} late events");
                    BatchReprocess(toProcess);
                }
            }
        });
    }

    private void BatchReprocess(List<(Event Event, DateTime Timestamp)> events)
    {
        // Reprocess late events in batch
    }

    private void ProcessSummary(WindowSummary summary)
    {
        Console.WriteLine($"[{summary.EmissionType}] {summary.Category}: " +
            $"{summary.Count} events ({summary.WindowStart:HH:mm}-{summary.WindowEnd:HH:mm})");
    }
}
```

## Window Emission Types

Windows emit results with an `EmissionType` indicating the nature of the emission:

```csharp
public enum WindowEmissionType
{
    Normal,      // Standard emission
    Early,       // Partial results before window closes
    OnTime,      // Results at window close time
    Late,        // Results after window close (for late data)
    Retraction   // Previous result should be removed
}
```

**Handling Different Emission Types:**

```csharp
stream
    .AdvancedTumblingWindow<string>(/* config */)
    .Map(window =>
    {
        switch (window.EmissionType)
        {
            case WindowEmissionType.Early:
                // Partial result - may be updated
                return new Result(window, Status.Preliminary);
                
            case WindowEmissionType.OnTime:
                // Normal window close - typically final
                return new Result(window, Status.Final);
                
            case WindowEmissionType.Late:
                // Late data arrived - update previous result
                return new Result(window, Status.Updated);
                
            case WindowEmissionType.Retraction:
                // Delete previous result
                return new Result(window, Status.Retract);
                
            default:
                return new Result(window, Status.Normal);
        }
    })
    .Build();
```

## Complete Advanced Configuration Example

```csharp
using Cortex.Streams;
using Cortex.Streams.Operators.Windows;
using Cortex.Streams.Operators.Windows.Triggers;

public record FinancialTransaction(
    string AccountId,
    string Type,
    decimal Amount,
    DateTime Timestamp);

public class AdvancedTransactionProcessor
{
    private readonly ITransactionStore _store;
    private readonly IAlertService _alerts;

    public AdvancedTransactionProcessor(
        ITransactionStore store, 
        IAlertService alerts)
    {
        _store = store;
        _alerts = alerts;
    }

    public void Start()
    {
        // Complex configuration combining multiple features
        var config = WindowConfiguration<FinancialTransaction>.Create()
            // Fire every 100 transactions OR every 30 seconds, whichever first
            .WithTrigger(new OrTrigger<FinancialTransaction>(
                CountTrigger<FinancialTransaction>.Of(100),
                ProcessingTimeTrigger<FinancialTransaction>.Every(TimeSpan.FromSeconds(30))))
            // Include all transactions in each emission for running totals
            .WithStateMode(WindowStateMode.Accumulating)
            // Accept late transactions up to 10 minutes after window close
            .WithAllowedLateness(TimeSpan.FromMinutes(10))
            // Handle dropped late transactions
            .OnLateEvent(HandleDroppedTransaction)
            .Build();

        var stream = StreamBuilder<FinancialTransaction>
            .CreateNewStream("Financial Transaction Processor")
            .Stream()
            // Filter suspicious transactions
            .Filter(t => t.Amount > 0)
            // 5-minute windows per account
            .AdvancedTumblingWindow<string>(
                keySelector: t => t.AccountId,
                timestampSelector: t => t.Timestamp,
                windowSize: TimeSpan.FromMinutes(5),
                config: config)
            .Map(ProcessWindow)
            // Branch for suspicious activity
            .AddBranch("SuspiciousActivity", branch => branch
                .Filter(r => r.IsSuspicious)
                .Sink(r => _alerts.RaiseSuspiciousActivityAlert(r)))
            // Branch for high-volume accounts
            .AddBranch("HighVolume", branch => branch
                .Filter(r => r.TransactionCount > 50)
                .Sink(r => _alerts.RaiseHighVolumeAlert(r)))
            // Main sink - store all results
            .Sink(StoreResult)
            .Build();

        stream.Start();
    }

    private AccountSummary ProcessWindow(WindowResult<string, FinancialTransaction> window)
    {
        var transactions = window.Items;
        var credits = transactions.Where(t => t.Type == "credit").Sum(t => t.Amount);
        var debits = transactions.Where(t => t.Type == "debit").Sum(t => t.Amount);
        
        // Detect suspicious patterns
        var rapidTransactions = CountRapidTransactions(transactions);
        var isSuspicious = rapidTransactions > 10 || debits > 50000;

        return new AccountSummary
        {
            AccountId = window.Key,
            WindowStart = window.WindowStart,
            WindowEnd = window.WindowEnd,
            EmissionType = window.EmissionType.ToString(),
            EmissionSequence = window.EmissionSequence,
            IsFinal = window.IsFinal,
            TotalCredits = credits,
            TotalDebits = debits,
            NetChange = credits - debits,
            TransactionCount = transactions.Count,
            IsSuspicious = isSuspicious,
            RapidTransactions = rapidTransactions
        };
    }

    private int CountRapidTransactions(IReadOnlyList<FinancialTransaction> transactions)
    {
        // Count transactions within 1 minute of each other
        var sorted = transactions.OrderBy(t => t.Timestamp).ToList();
        int rapid = 0;
        for (int i = 1; i < sorted.Count; i++)
        {
            if ((sorted[i].Timestamp - sorted[i-1].Timestamp).TotalMinutes < 1)
                rapid++;
        }
        return rapid;
    }

    private void HandleDroppedTransaction(FinancialTransaction txn, DateTime timestamp)
    {
        // Log and store for manual review
        Console.WriteLine($"?? Late transaction dropped: {txn.AccountId} ${txn.Amount} at {timestamp}");
        _store.StoreLateTransaction(txn, timestamp, "dropped_beyond_allowed_lateness");
    }

    private void StoreResult(AccountSummary summary)
    {
        var key = $"{summary.AccountId}:{summary.WindowStart:yyyyMMddHHmm}";
        
        if (summary.EmissionType == "Retraction")
        {
            _store.Delete(key);
        }
        else
        {
            _store.Upsert(key, summary);
        }
        
        Console.WriteLine($"[{summary.EmissionType}] Account {summary.AccountId}: " +
            $"${summary.NetChange:+#;-#;0} ({summary.TransactionCount} txns)");
    }
}

public record AccountSummary
{
    public string AccountId { get; init; }
    public DateTime WindowStart { get; init; }
    public DateTime WindowEnd { get; init; }
    public string EmissionType { get; init; }
    public int EmissionSequence { get; init; }
    public bool IsFinal { get; init; }
    public decimal TotalCredits { get; init; }
    public decimal TotalDebits { get; init; }
    public decimal NetChange { get; init; }
    public int TransactionCount { get; init; }
    public bool IsSuspicious { get; init; }
    public int RapidTransactions { get; init; }
}
```

## Best Practices

1. **Choose state mode based on downstream needs**: Discarding for batches, Accumulating for totals
2. **Set realistic allowed lateness**: Based on actual data arrival patterns
3. **Always handle late events**: Log, store, or alert - don't lose data silently
4. **Test emission types**: Ensure downstream handles Early, OnTime, Late, and Retraction
5. **Monitor emission frequency**: Too many emissions = overhead; too few = latency
6. **Consider memory with Accumulating mode**: Windows hold all data until close
7. **Use persistent state stores for critical windows**: Enables recovery after failures
