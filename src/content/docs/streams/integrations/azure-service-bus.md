---
title: Azure Service Bus
description: How to integrate Azure Service Bus in Cortex.Streams
---

The **Cortex.Streams.AzureServiceBus** package integrates [Azure Service Bus](https://learn.microsoft.com/en-us/azure/service-bus-messaging/) with the Cortex streaming framework. It provides source and sink operators built on the modern `Azure.Messaging.ServiceBus` client. The operators support JSON serialization out of the box and can be customized with your own serializers or Service Bus options.

## Installation

Add the NuGet package:

```bash
dotnet add package Cortex.Streams.AzureServiceBus
```

## Azure Service Bus Source Operator
Use `AzureServiceBusSourceOperator` to consume messages from a queue or topic/subscription. The constructor accepts the Service Bus connection string and the queue or topic name. You may optionally provide a custom deserializer and `ServiceBusProcessorOptions`. If no deserializer is provided, JSON is used by default. When no options are supplied, a processor is configured with `AutoCompleteMessages=false`, `MaxConcurrentCalls=1` and `ReceiveMode=PeekLock`.

Calling `Start` creates a `ServiceBusProcessor`, registers message and error handlers, and begins processing. In the message handler each `ServiceBusMessage` body is converted to a string, deserialized and emitted into the stream, after which the message is completed (acknowledged). Errors are logged and the message is abandoned to allow retries. Calling `Stop` stops processing and disposes the processor.

### Example: Consuming from Azure Service Bus

```csharp
using Cortex.Streams;
using Cortex.Streams.AzureServiceBus;

var source = new AzureServiceBusSourceOperator<MyEvent>(
    connectionString: Environment.GetEnvironmentVariable("SERVICEBUS_CONNSTR"),
    queueOrTopicName: "orders");

var stream = StreamBuilder<MyEvent>
    .CreateNewStream("ServiceBusConsumer")
    .Source(source)
    .Sink(evt => Console.WriteLine($"Order received: {evt.Id}"))
    .Build();

stream.Start();
```

### Customizing the consumer

You can pass a `ServiceBusProcessorOptions` object to configure concurrency, prefetching and auto‑completion. For example:

```csharp
var options = new ServiceBusProcessorOptions
{
    MaxConcurrentCalls = 4,
    AutoCompleteMessages = false,
    ReceiveMode = ServiceBusReceiveMode.PeekLock
};

var source = new AzureServiceBusSourceOperator<MyEvent>(
    connectionString, "orders",
    deserializer: new MyCustomDeserializer(),
    serviceBusProcessorOptions: options);

```

## Azure Service Bus Sink Operator

`AzureServiceBusSinkOperator` publishes messages to a queue or topic. The constructor accepts the Service Bus connection string, the queue or topic name and an optional serializer. If no serializer is provided, a default JSON serializer is used. Calling `Start` creates a `ServiceBusClient` and `ServiceBusSender`.

`Process` serializes the input object, wraps it in a `ServiceBusMessage` with `ContentType=application/json` and Subject set to the type name, and sends it asynchronously. Attempted sends are wrapped in a `try/catch` and logged on failure. Calling Stop disposes the client and sender and ensures no more messages are sent.

### Example: Producing to Azure Service Bus

```csharp
using Cortex.Streams;
using Cortex.Streams.AzureServiceBus;

var sink = new AzureServiceBusSinkOperator<MyEvent>(
    connectionString: Environment.GetEnvironmentVariable("SERVICEBUS_CONNSTR"),
    queueOrTopicName: "orders");

var stream = StreamBuilder<MyEvent>
    .CreateNewStream("ServiceBusProducer")
    .Source()
    .Sink(sink)
    .Build();

stream.Start();

stream.Emit(new MyEvent { Id = 42, Description = "New order" });
```

## Serializers and deserializers

The operators use JSON serialization by default. You can plug in your own `ISerializer<T>` or `IDeserializer<T>` implementation to work with XML, Avro or other encodings. For advanced scenarios you can also set message properties (e.g., `TimeToLive`, `SessionId`) inside a custom serializer.

## Error handling
Both operators log exceptions to the console. When consuming, message processing errors result in the message being abandoned so it can be retried. When publishing, failures are logged and you can extend the sink to implement retries or send failed messages to a dead‑letter queue.
