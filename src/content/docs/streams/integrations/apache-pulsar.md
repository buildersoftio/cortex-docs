---
title: Apache Pulsar
description: How to integrate Apache Pulsar in Cortex.Streams
---

The **Cortex.Streams.Pulsar** package provides source and sink operators for [Apache Pulsar](https://pulsar.apache.org/) built on top of the [DotPulsar](https://github.com/apache/pulsar-dotpulsar) client. These operators integrate seamlessly with the **Cortex Streams** and let you read from or write to Pulsar topics using familiar .NET types and serializers.

## Installation

Add the NuGet package:

```bash
dotnet add package Cortex.Streams.Pulsar
```

## Pulsar Source Operator

Use `PulsarSourceOperator` to consume messages from a Pulsar topic. The constructor accepts the service URL and the topic name. You may optionally pass a `ConsumerOptions` object and/or a custom deserializer. If no deserializer is supplied, JSON is used by default. When no consumer options are provided, the operator creates a consumer with an auto‑generated subscription name and sets the initial position to the earliest available message. Messages are deserialized and emitted into the stream, and acknowledgements are sent automatically.

### Example: Consuming from a Pulsar topic

```csharp
using Cortex.Streams;
using Cortex.Streams.Pulsar;

var source = new PulsarSourceOperator<MyEvent>(
    serviceUrl: "pulsar://localhost:6650",
    topic: "persistent://public/default/my-topic");

var stream = StreamBuilder<MyEvent>
    .CreateNewStream("PulsarConsumer")
    .Source(source)
    .Map(evt => evt)  // transform or filter as needed
    .Sink(Console.WriteLine)
    .Build();

stream.Start();
```

In this example the source subscribes to the `my-topic` topic and emits deserialized `MyEvent` objects into the stream. By default the operator uses a new subscription name each time so multiple consumers do not interfere.

### Customizing the consumer

If you need finer control—such as specifying a subscription name, subscription type or start position—create and pass a `ConsumerOptions` instance when constructing the operator. You can also supply a custom `IDeserializer<T>` to handle Avro, Protobuf or other formats. For example:

```csharp
var options = new ConsumerOptions<MyEvent>
{
    SubscriptionName = "analytics",
    SubscriptionType = SubscriptionType.Shared,
    Topic = "persistent://public/default/my-topic",
    InitialPosition = SubscriptionInitialPosition.Latest
};

var source = new PulsarSourceOperator<MyEvent>(
    serviceUrl: "pulsar://localhost:6650",
    consumerOptions: options,
    deserializer: new MyCustomDeserializer());
```

## Pulsar Sink Operator

`PulsarSinkOperator` publishes records to a Pulsar topic. The constructor takes the service URL, topic name and an optional serializer. If you do not specify a serializer, the operator uses a default JSON serializer. The internal Pulsar client and producer are created when the operator is initialized; due to a known behaviour in the DotPulsar client, the producer is started immediately.

### Example: Producing to a Pulsar topic

```csharp
using Cortex.Streams;
using Cortex.Streams.Pulsar;

var sink = new PulsarSinkOperator<MyEvent>(
    serviceUrl: "pulsar://localhost:6650",
    topic: "persistent://public/default/my-topic");

var stream = StreamBuilder<MyEvent>
    .CreateNewStream("PulsarProducer")
    .Source()
    .Sink(sink)
    .Build();

stream.Start();

// Emit an object to send it to Pulsar
stream.Emit(new MyEvent { Id = 1, Value = "hello" });
```

`PulsarSinkOperator` serializes each record and calls Send on the producer. It is suitable for low‑latency event publishing.

## Serializers and deserializers

The Pulsar operators use JSON serialization by default. You can supply your own `ISerializer<T>` or `IDeserializer<T>` to support other encoding formats such as Avro, Protobuf or base64. Pass the custom serializer/deserializer when constructing the operator as shown above.

## Error handling
The Pulsar operators rely on the underlying DotPulsar client. If the connection drops or a send/receive error occurs, exceptions are written to the console by the client. You can add try/catch blocks around your stream start and implement your own retry or dead‑letter logic by using a custom serializer/deserializer.