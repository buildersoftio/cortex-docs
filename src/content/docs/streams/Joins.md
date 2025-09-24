---
title: Joins
description: How to use Joins in Cortex.Streams
---

The Join operator in the Cortex Data Framework enables you to combine events from one stream with related data stored in a state store (often acting as a table). By correlating a streaming event (the “left” stream) with a persistent or aggregated dataset (the “right” table), you can enrich real-time data processing with historical or reference data.

In traditional databases, joins combine rows from two tables based on matching keys. In stream processing, joins perform a similar role by merging a continuous flow of events with another dataset. In **Cortex**, a common pattern is to use a state store to represent the “right” side of a join. The state store maintains a table-like view of data that can be queried on the fly.

The key benefits include:

- **Real-Time Enrichment**: Merge live events with static or slowly changing data.
- **Correlation**: Link disparate data sources to produce a unified view.
- **Flexibility**: Join operations can be applied using various state store implementations (e.g., in-memory, Cassandra, MongoDB).

## How the Join Operator Works

1. **State Store as a Table**:\
A state store (like `InMemoryStateStore`) is used to aggregate or hold the right-hand data. This store is often updated by its own dedicated stream that aggregates events into a table-like structure.

2. **Key Extraction**:\
The join operator requires a function to extract a key from the left event. This key is used to look up corresponding data in the state store.

3. **Result Projection**:\
A projection function is provided to merge the left event and the matching right data into a unified result (commonly a custom object).

4. **Execution Semantics**:\
When an event arrives on the left stream, the operator queries the state store using the extracted key. If a match is found, the two pieces are combined. Otherwise, behavior can vary (e.g., emitting a null result, skipping the event, or applying a default value).

## Real-World Use Cases

### User Activity Enrichment
Imagine you have a stream of user actions (clicks, logins, purchases) and a table of user profiles maintained in a state store. By joining the user activity stream (left) with the user profile table (right), you can immediately enrich each event with demographic or preference data, enabling real-time personalization or anomaly detection.

**Example 1: User Activity Enrichment**\
In this scenario, a stream of user profile updates is aggregated into a state store. A separate stream of user activities then joins with that store so that each activity is enriched with the user’s profile information.


```csharp
using System;
using Cortex.States;
using Cortex.Streams;

namespace Cortex.Examples
{
    public class UserActivityEnrichmentExample
    {
        public UserActivityEnrichmentExample() => Run();

        private void Run()
        {
            // Create a state store for user profiles.
            var userProfileStore = new InMemoryStateStore<string, UserProfile>("UserProfileStore");
            // Aggregate user profile updates into the state store.
            var userProfileStream = StreamBuilder<UserProfile, UserProfile>
                .CreateNewStream("UserProfileStream")
                .Stream()
                .AggregateSilently(
                    profile => profile.UserId,
                    (current, update) => update,
                    stateStore: userProfileStore)
                .Sink(_ => { })
                .Build();

            // Create a stream for user activities that joins with the user profile store.
            var userActivityStream = StreamBuilder<UserActivity, UserActivity>
                .CreateNewStream("UserActivityStream")
                .Stream()
                .Join(
                    userProfileStore,
                    activity => activity.UserId,
                    (activity, profile) => new EnrichedUserActivity
                    {
                        Activity = activity,
                        Profile = profile
                    })
                .Sink(result => Console.WriteLine(
                    $"User {result.Activity.UserId} performed {result.Activity.Action} with profile name {result.Profile?.Name}"))
                .Build();

            // Start the streams.
            userProfileStream.Start();
            userActivityStream.Start();

            // Emit profile update.
            userProfileStream.Emit(new UserProfile { UserId = "U123", Name = "Alice", Age = 30 });
            // Emit a user activity event.
            userActivityStream.Emit(new UserActivity { UserId = "U123", Action = "Login", Timestamp = DateTime.UtcNow });
        }
    }

    public class UserProfile
    {
        public string UserId { get; set; }
        public string Name { get; set; }
        public int Age { get; set; }
    }

    public class UserActivity
    {
        public string UserId { get; set; }
        public string Action { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class EnrichedUserActivity
    {
        public UserActivity Activity { get; set; }
        public UserProfile Profile { get; set; }
    }
}
```

### IoT Sensor Data Correlation 
In an IoT scenario, you might receive sensor readings from devices in a stream while keeping device configuration or calibration data in a state store. A join allows you to combine each sensor reading with its corresponding configuration data, ensuring that you always process sensor data in the correct context.

**Example 2: IoT Sensor Data Correlation**\
In this example, sensor configuration data (such as location and calibration factors) is stored in a state store. A stream of sensor readings then joins with the configuration data to produce enriched readings with context.

```csharp
using System;
using Cortex.States;
using Cortex.Streams;

namespace Cortex.Examples
{
    public class SensorDataCorrelationExample
    {
        public SensorDataCorrelationExample() => Run();

        private void Run()
        {
            // Create a state store for sensor configurations.
            var sensorConfigStore = new InMemoryStateStore<string, SensorConfig>("SensorConfigStore");
            // Aggregate sensor configuration updates.
            var sensorConfigStream = StreamBuilder<SensorConfig, SensorConfig>
                .CreateNewStream("SensorConfigStream")
                .Stream()
                .AggregateSilently(
                    config => config.SensorId,
                    (current, update) => update,
                    stateStore: sensorConfigStore)
                .Sink(_ => { })
                .Build();

            // Create a stream for sensor readings that joins with the sensor config store.
            var sensorReadingStream = StreamBuilder<SensorReading, SensorReading>
                .CreateNewStream("SensorReadingStream")
                .Stream()
                .Join(
                    sensorConfigStore,
                    reading => reading.SensorId,
                    (reading, config) => new CorrelatedSensorData 
                    { 
                        Reading = reading, 
                        Config = config 
                    })
                .Sink(result => Console.WriteLine(
                    $"Sensor {result.Reading.SensorId} reading {result.Reading.Value} from location {result.Config?.Location}"))
                .Build();

            // Start both streams.
            sensorConfigStream.Start();
            sensorReadingStream.Start();

            // Emit sensor configuration.
            sensorConfigStream.Emit(new SensorConfig { SensorId = "S001", Location = "Building A", Calibration = 1.05 });
            // Emit a sensor reading.
            sensorReadingStream.Emit(new SensorReading { SensorId = "S001", Value = 23.7, Timestamp = DateTime.UtcNow });
        }
    }

    public class SensorConfig
    {
        public string SensorId { get; set; }
        public string Location { get; set; }
        public double Calibration { get; set; }
    }

    public class SensorReading
    {
        public string SensorId { get; set; }
        public double Value { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class CorrelatedSensorData
    {
        public SensorReading Reading { get; set; }
        public SensorConfig Config { get; set; }
    }
}
```

### Financial Transactions with Reference Data
Consider a financial system where live transaction events are joined with a static dataset of currency conversion rates or account metadata. This join provides the necessary context for evaluating transactions in real time, such as converting amounts to a common currency or flagging transactions based on account profiles.

**Example 3: Financial Transactions with Reference Data**\
Here, a state store holds currency exchange rates. A transaction stream joins with this store to convert transaction amounts into a common currency (e.g., USD) for immediate financial analysis.

```csharp
using System;
using Cortex.States;
using Cortex.Streams;

namespace Cortex.Examples
{
    public class TransactionEnrichmentExample
    {
        public TransactionEnrichmentExample() => Run();

        private void Run()
        {
            // Create a state store for currency exchange rates.
            var exchangeRateStore = new InMemoryStateStore<string, ExchangeRate>("ExchangeRateStore");
            // Aggregate exchange rate updates.
            var exchangeRateStream = StreamBuilder<ExchangeRate, ExchangeRate>
                .CreateNewStream("ExchangeRateStream")
                .Stream()
                .AggregateSilently(
                    rate => rate.Currency,
                    (current, update) => update,
                    stateStore: exchangeRateStore)
                .Sink(_ => { })
                .Build();

            // Create a stream for financial transactions that joins with the exchange rate store.
            var transactionStream = StreamBuilder<Transaction, Transaction>
                .CreateNewStream("TransactionStream")
                .Stream()
                .Join(
                    exchangeRateStore,
                    txn => txn.Currency,
                    (txn, rate) => new EnrichedTransaction 
                    { 
                        Transaction = txn, 
                        Rate = rate 
                    })
                .Sink(result =>
                {
                    double convertedAmount = result.Transaction.Amount * (result.Rate?.RateToUSD ?? 1);
                    Console.WriteLine($"Transaction {result.Transaction.TransactionId}: {result.Transaction.Amount} {result.Transaction.Currency} converted to USD: {convertedAmount}");
                })
                .Build();

            // Start both streams.
            exchangeRateStream.Start();
            transactionStream.Start();

            // Emit an exchange rate update.
            exchangeRateStream.Emit(new ExchangeRate { Currency = "EUR", RateToUSD = 1.1 });
            // Emit a transaction.
            transactionStream.Emit(new Transaction { TransactionId = "T1001", Amount = 100, Currency = "EUR", Timestamp = DateTime.UtcNow });
        }
    }

    public class ExchangeRate
    {
        public string Currency { get; set; }
        public double RateToUSD { get; set; }
    }

    public class Transaction
    {
        public string TransactionId { get; set; }
        public double Amount { get; set; }
        public string Currency { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class EnrichedTransaction
    {
        public Transaction Transaction { get; set; }
        public ExchangeRate Rate { get; set; }
    }
}
```

## Best Practices
- **Key Design**:\
Ensure that the key extraction functions used in both the state store aggregation and the join are consistent. A mismatch can lead to missing join results.

- **State Store Choice**:\
Depending on your latency and persistence requirements, choose an appropriate state store implementation. For low latency and small datasets, an in-memory store may suffice. For larger or more durable data, consider distributed state stores like Cassandra or MongoDB.

- **Handling Missing Joins**:\
Decide how to handle cases where no matching right event exists. This might involve emitting a default value, logging the anomaly, or using a left outer join semantics.

- **Resource Management**:\
Since joins can involve additional state lookups, consider the performance and resource usage, especially with high-throughput streams. Ensure that state stores are efficiently indexed and maintained.