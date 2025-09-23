---
title: Window Operators
description: How to use Window Operators in Cortex.Streams

sidebar:
  badge:
    text: Experimental
    variant: caution
---


Window operators process data within defined time frames or sessions, enabling temporal aggregations and analyses. Cortex Data Framework provides three primary window operators: **Tumbling Window**, **Sliding Window**, and **Session Window**. Each serves different use cases based on the nature of data processing required.

***

## Tumbling Window Operator

**Description and Use Cases**\
The **Tumbling Window Operator** divides the data stream into fixed-size, non-overlapping time windows. Each window processes the data that arrives within its duration, and windows do not overlap or skip time intervals.

**Use Cases:**
- **Fixed Interval Aggregations**: Calculating metrics like counts or sums over consistent time periods (e.g., hourly sales totals).
- **Batch Processing**: Grouping data into batches for processing at regular intervals.
- **Periodic Reporting**: Generating reports based on fixed time frames.

**Implementation Guide**\
To implement the Tumbling Window Operator, follow these steps:

1. **Define the Key Selector and Window Function**:
   - Key Selector: Determines how to group data items.
   - Window Function: Defines the aggregation or processing to perform on each window.
2. **Configure the Window State Stores**:
   - Use state stores to maintain window states and store window results.
3. **Integrate the Operator into the Stream**:
   - Use the `TumblingWindow` method provided by the `StreamBuilder` to add the operator to the pipeline.
4. **Handle Telemetry** (Optional):
Configure telemetry to monitor window processing metrics and performance.

**Code Example**\
The following example demonstrates the Tumbling Window Operator by calculating the total number of transactions every minute.

```csharp
using Cortex.States.RocksDb;
using Cortex.Streams;
using System;

class Program
{
    static void Main(string[] args)
    {
        // Create and configure the stream with a Tumbling Window operator
        var stream = StreamBuilder<string, string>.CreateNewStream("TransactionStream")
            .Stream()
            .TumblingWindow(
                keySelector: transaction => "TotalTransactions",    // Single key for all transactions
                windowDuration: TimeSpan.FromMinutes(1),             // 1-minute window
                windowFunction: transactions => transactions.Count(),  // Count transactions in the window
                stateStoreName: "TransactionResultsStore"
            )
            .Sink(v => Console.WriteLine($"Start: TotalTransactions, Transactions: {v}")) // Output window counts
            .Build();

        // Start the stream
        stream.Start();

        // Simulate emitting transactions over time
        var transactions = new[] { "txn1", "txn2", "txn3", "txn4", "txn5" };
        foreach (var txn in transactions)
        {
            stream.Emit(txn);
            System.Threading.Thread.Sleep(1000); // Wait for 1 second between transactions
        }

        // Wait for window to close
        System.Threading.Thread.Sleep(TimeSpan.FromMinutes(1));

        // Stop the stream after processing
        stream.Stop();
    }
}
```

*Output:*
```bash
Window Start: TotalTransactions, Transactions: 5
```

**Explanation:**
1. **State Store Initialization**: A `RocksDbStateStore` named "TransactionCountStore" is initialized to persist transaction counts.
2. **Stream Configuration**:
   - **Tumbling Window Operator**: Groups transactions into 1-minute windows and counts them.
   - **Sink Operator**: Outputs the window start key and the count of transactions.
3. **Data Emission**: Simulates emitting five transactions, one every second.
4. **Window Processing**: After 1 minute, the window closes, and the total number of transactions is outputted.
5. **Stream Lifecycle**: The stream is started, data is emitted, the window is processed, and then the stream is stopped.

***

## Sliding Window Operator

**Description and Use Cases**\
The **Sliding Window Operator** divides the data stream into fixed-size windows that overlap based on a specified advance interval. Unlike tumbling windows, sliding windows allow for continuous and overlapping data processing, enabling more granular and real-time analyses.

**Use Cases:**
- **Moving Averages**: Calculating rolling averages over recent data points.
- **Trend Detection**: Identifying trends within overlapping time frames.
- **Real-Time Monitoring**: Continuously monitoring metrics with overlapping windows for immediate insights.

**Implementation Guide**\
To implement the **Sliding Window Operator**, follow these steps:

1. **Define the Key Selector and Window Function**:
   - **Key Selector**: Determines how to group data items.
   - **Window Function**: Defines the aggregation or processing to perform on each window.
2. **Configure the Sliding Window State Stores**:
   - Use state stores to maintain window states and store window results.
3. **Integrate the Operator into the Stream**:
   - Use the `SlidingWindow` method provided by the `StreamBuilder` to add the operator to the pipeline.
4. **Handle Telemetry (Optional)**:
   - Configure telemetry to monitor window processing metrics and performance.

**Code Example**\
The following example demonstrates the **Sliding Window Operator** by calculating a moving average of sensor readings over a 5-minute window, advancing every minute.

```csharp
using Cortex.States.RocksDb;
using Cortex.Streams;
using System;
using System.Collections.Generic;

class Program
{
    static void Main(string[] args)
    {
        // Create and configure the stream with a Sliding Window operator
        var stream = StreamBuilder<double, double>.CreateNewStream("SensorStream")
            .Stream()
            .SlidingWindow(
                keySelector: value => "Sensor1",                          // Single sensor key
                windowSize: TimeSpan.FromMinutes(5),                       // 5-minute window size
                advanceBy: TimeSpan.FromMinutes(1),                        // Advance interval of 1 minute
                windowFunction: values =>
                {
                    double sum = 0;
                    foreach (var val in values)
                        sum += val;
                    return sum / values.Count(); // Calculate average
                },
                windowStateStoreName: "SensorDataStore",
                windowResultsStateStoreName: "SensorResultsStore"
            )
            .Sink(average => Console.WriteLine($"Moving Average: {average:F2}")) // Output moving average
            .Build();

        // Start the stream
        stream.Start();

        // Simulate emitting sensor readings every 30 seconds
        for (int i = 1; i <= 10; i++)
        {
            double sensorValue = 20.0 + i; // Example sensor value
            stream.Emit(sensorValue);
            Console.WriteLine($"Emitted Sensor Value: {sensorValue}");
            System.Threading.Thread.Sleep(TimeSpan.FromSeconds(30));
        }

        // Wait for sliding windows to process
        System.Threading.Thread.Sleep(TimeSpan.FromMinutes(6));

        // Stop the stream after processing
        stream.Stop();
    }
}
```

*Output:*

```bash
Emitted Sensor Value: 21
Emitted Sensor Value: 22
Emitted Sensor Value: 23
Emitted Sensor Value: 24
Emitted Sensor Value: 25
Emitted Sensor Value: 26
Emitted Sensor Value: 27
Emitted Sensor Value: 28
Emitted Sensor Value: 29
Emitted Sensor Value: 30
Moving Average: 23.00
Moving Average: 24.00
Moving Average: 25.00
Moving Average: 26.00
Moving Average: 27.00
```

**Explanation:**

1. **Stream Configuration**:
   - **Sliding Window Operator**: Groups sensor readings into overlapping 5-minute windows, advancing every minute, and calculates the average.
   - **Sink Operator**: Outputs the moving average to the console.
2. **Data Emission**: Simulates emitting ten sensor readings, one every 30 seconds.
3. **Window Processing**: As readings are emitted, the sliding window calculates and outputs the moving average every minute.
4. **Stream Lifecycle**: The stream is started, data is emitted, moving averages are calculated and outputted, and then the stream is stopped.

***

## Session Window Operator

**Description and Use Cases**\
The **Session Window Operator** groups data items into sessions based on activity gaps. A new session is started when data arrives after a period of inactivity defined by the inactivity gap. This operator is ideal for scenarios where data is naturally segmented by periods of activity and inactivity.

**Use Cases:**
- **User Activity Tracking**: Grouping user actions into sessions based on inactivity.
- **Event Correlation**: Correlating events that occur within active periods.
- **Transaction Sessions**: Grouping transactions that belong to the same session.

**Implementation Guide**
To implement the **Session Window Operator**, follow these steps:

1. **Define the Key Selector and Window Function**:
   - **Key Selector**: Determines how to group data items.
   - **Window Function**: Defines the aggregation or processing to perform on each session.
2. **Configure the Session Window State Stores**:
   - Use state stores to maintain session states and store session results.
3. **Integrate the Operator into the Stream**:
   - Use the `SessionWindow` method provided by the `StreamBuilder` to add the operator to the pipeline.
4. **Handle Telemetry (Optional)**:
   - Configure telemetry to monitor session processing metrics and performance.

**Code Example**\
The following example demonstrates the Session Window Operator by tracking user sessions based on inactivity gaps. A new session is initiated if there's no activity for 2 minutes.

```csharp
using Cortex.States.RocksDb;
using Cortex.Streams;
using System;
using System.Collections.Generic;

class Program
{
    static void Main(string[] args)
    {
        // Initialize a RocksDbStateStore for session states
        var sessionStateStore = new RocksDbStateStore<string, SessionWindowState<string>>("UserSessionStore", "/path/to/rocksdb");
        var sessionResultsStore = new RocksDbStateStore<(string, DateTime), string>("SessionResultsStore", "/path/to/rocksdb");

        // Create and configure the stream with a Session Window operator
        var stream = StreamBuilder<string, string>.CreateNewStream("UserActivityStream")
            .Stream()
            .SessionWindow(
                keySelector: activity => activity,                   // Group by user ID or activity type
                inactivityGap: TimeSpan.FromMinutes(2),             // 2-minute inactivity gap
                windowFunction: activities =>
                {
                    // Example: Concatenate all activities in the session
                    return string.Join(", ", activities);
                },
                sessionStateStoreName: "UserSessionStore",
                windowResultsStateStoreName: "SessionResultsStore",
                sessionStateStore: sessionStateStore,
                windowResultsStateStore: sessionResultsStore
            )
            .Sink(sessionSummary => Console.WriteLine($"Session Activities: {sessionSummary}")) // Output session summaries
            .Build();

        // Start the stream
        stream.Start();

        // Simulate emitting user activities with varying delays
        var activities = new List<string>
        {
            "Login",
            "ViewDashboard",
            "ClickButton",
            "Logout",
            "Login",
            "UploadFile",
            "Logout"
        };

        foreach (var activity in activities)
        {
            stream.Emit(activity);
            Console.WriteLine($"Emitted Activity: {activity}");
            System.Threading.Thread.Sleep(TimeSpan.FromMinutes(1)); // Wait for 1 minute between activities
        }

        // Wait for sessions to close
        System.Threading.Thread.Sleep(TimeSpan.FromMinutes(3));

        // Stop the stream after processing
        stream.Stop();
    }
}
```

*Output:*

```bash
Emitted Activity: Login
Emitted Activity: ViewDashboard
Emitted Activity: ClickButton
Emitted Activity: Logout
Emitted Activity: Login
Emitted Activity: UploadFile
Emitted Activity: Logout
Session Activities: Login, ViewDashboard, ClickButton, Logout
Session Activities: Login, UploadFile, Logout
```

**Explanation:**
1. **State Store Initialization**: Two RocksDbStateStore instances are initialized:
   - **UserSessionStore**: Maintains the state of active user sessions.
   - **SessionResultsStore**: Stores the results of processed sessions.

2. **Stream Configuration**:
   - **Session Window Operator**: Groups user activities into sessions based on a 2-minute inactivity gap and concatenates activities within each session.
   - **Sink Operator**: Outputs the concatenated session activities to the console.
3. **Data Emission**: Simulates emitting seven user activities, with a 1-minute interval between each. Given the 2-minute inactivity gap, activities are grouped into two sessions.

4. **Session Processing**: After the inactivity gap, the sessions are processed and the concatenated activities are outputted.

5. **Stream Lifecycle**: The stream is started, data is emitted, sessions are processed and outputted, and then the stream is stopped.

