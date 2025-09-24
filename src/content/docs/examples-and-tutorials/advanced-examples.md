---
title: Advanced  Examples
description: Examples related Cortex Data Framework
---

## Examples and Tutorials

## Overview

Welcome to the Cortex Examples and Tutorials page! This guide is designed to help you understand how to use Cortex by walking you through various examples, ranging from basic data transformations to advanced stream processing scenarios. We'll cover all types of operators, including **TumblingWindow**, **SlidingWindow**, and **SessionWindow**, ensuring that they are used appropriately within the stream processing pipeline.


### Example 1: Complex Stream with Branching
**Objective**: Process IoT sensor data with multiple branches, applying different processing logic, without using windowing operators inside branches (since windowing inside branches is currently not supported in v1.0, support will arrive with v1.1).

```csharp
using Cortex.Streams;
using Cortex.States;

public class SensorData
{
    public string SensorId { get; set; }
    public double Value { get; set; }
    public DateTime Timestamp { get; set; }
}

var stream = StreamBuilder<SensorData, SensorData>.CreateNewStream("IoTDataStream")
    .Stream()
    .AddBranch("TemperatureBranch", branch =>
    {
        // Filter temperature sensors and process
        branch
            .Filter(data => data.SensorId.StartsWith("Temp"))
            .Map(data => data.Value)
            .Sink(tempValue => Console.WriteLine($"Temperature reading: {tempValue}°C"));
    })
    .AddBranch("HumidityBranch", branch =>
    {
        // Filter humidity sensors and process
        branch
            .Filter(data => data.SensorId.StartsWith("Humid"))
            .Map(data => data.Value)
            .Sink(humidValue => Console.WriteLine($"Humidity reading: {humidValue}%"));
    })
    .AddBranch("AnomalyDetection", branch =>
    {
        // Detect anomalies
        branch
            .Filter(data => data.Value > 90) // Arbitrary anomaly condition
            .Sink(data => Console.WriteLine($"Anomaly detected on sensor {data.SensorId} with value {data.Value}!"));
    })
    .Build();

stream.Start();

// Simulating sensor data
var sensors = new[] { "Temp1", "Humid1", "Temp2", "Humid2" };
var random = new Random();
var timer = new System.Timers.Timer(1000);
int ticks = 0;
timer.Elapsed += (sender, args) =>
{
    if (ticks < 30)
    {
        foreach (var sensorId in sensors)
        {
            var data = new SensorData
            {
                SensorId = sensorId,
                Value = random.NextDouble() * 100,
                Timestamp = DateTime.UtcNow
            };
            stream.Emit(data);
        }
        ticks++;
    }
    else
    {
        timer.Stop();
        stream.Stop();
    }
};
timer.Start();
```

**Explanation**:
- Branching:
    - TemperatureBranch:
        - Filters temperature sensor data.
        - Maps to the sensor value.
        - Outputs the temperature readings.
    - HumidityBranch:
        - Filters humidity sensor data.
        - Maps to the sensor value.
        - Outputs the humidity readings.
    - AnomalyDetection:
        - Filters data where value exceeds 90.
        - Outputs an anomaly alert.


> *Note*: Since windowing operators are not currently supported inside branches, we dont have any state or window in place for the branches, use can add Windowing before the Sink in the main pipeline.

### Example 2: Real-Time Analytics Pipeline with External Integration
**Objective**: Build a real-time analytics pipeline that reads data from Kafka, processes it, and writes results back to Kafka if the log message is `ERROR` or `WARNING`.

```csharp
using Cortex.Streams;
using Cortex.Streams.Kafka;

public class LogMessage
{
    public string Level { get; set; } // INFO, WARNING, ERROR
    public string Message { get; set; }
    public DateTime Timestamp { get; set; }
}

var kafkaSource = new KafkaSourceOperator<LogMessage>(
    bootstrapServers: "localhost:9092",
    topic: "raw-logs"
);

var kafkaSink = new KafkaSinkOperator<string>(
    bootstrapServers: "localhost:9092",
    topic: "processed-logs"
);

var stream = StreamBuilder<LogMessage, LogMessage>.CreateNewStream("LogProcessingStream")
    .Stream(kafkaSource)
    .Map(log => new { LogLevel = log.Level, FormattedMessage = $"[{log.Level}] {log.Timestamp}: {log.Message}" })
    .AddBranch("ErrorAndWarningLogs", branch =>
    {
        branch
            .Filter(log => log.LogLevel == "ERROR" || log.LogLevel == "WARNING")
            .Map(log => log.FormattedMessage)
            .Sink(kafkaSink);
    })
    .AddBranch("InfoLogs", branch =>
    {
        branch
            .Filter(log => log.LogLevel == "INFO")
            .Map(log => log.FormattedMessage)
            .Sink(log => Console.WriteLine(log));
    })
    .Build();

stream.Start();

// The stream will now process logs from the "raw-logs" Kafka topic and output results.

Console.WriteLine("Press Enter to stop the stream.");
Console.ReadLine();

stream.Stop();

```

**Explanation**:

- **KafkaSourceOperator**: Reads log messages from a Kafka topic.
- **Map Operator**: Formats the log messages.
- **Branching**:
    - **ErrorAndWarningLogs**:
        - Filters logs by level (`ERROR` or `WARNING`).
        - Sends the formatted message to another Kafka topic using KafkaSinkOperator.
    - **InfoLogs**:
        - Filters logs with level `INFO`.
        - Outputs the formatted message to the console.

> **Note**: Ensure Kafka is running and the topics are properly configured.