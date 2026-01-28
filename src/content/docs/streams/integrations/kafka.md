---
title: Apache Kafka
description: How to integrate Kafka in Cortex.Streams
---

The **Cortex.Streams.Kafka** package provides source and sink operators for Apache Kafka. It wraps the [Confluent.Kafka](https://github.com/confluentinc/confluent-kafka-dotnet)
 client and integrates seamlessly with the Cortex Streams.

## Installation

Add the NuGet package:

```powershell
dotnet add package Cortex.Streams.Kafka
```

## Kafka Source Operator
Use `KafkaSourceOperator` when you want to consume messages from a Kafka topic. The constructor accepts the bootstrap servers, topic name and optional `ConsumerConfig` and deserializer. If no deserializer is provided, **JSON** is used by default. A random group‑id is generated and the consumer will automatically commit offsets.

### Example: Consuming records

```csharp
using Cortex.Streams;
using Cortex.Streams.Kafka;

var source = new KafkaSourceOperator<MyMessage>(
    bootstrapServers: "localhost:9092",
    topic: "my-topic");

var stream = StreamBuilder<MyMessage>
    .CreateNewStream("KafkaExample")
    .Source(source)
    .Map(msg => msg.Value)
    .Sink(Console.WriteLine)
    .Build();

stream.Start();
```

In this example `MyMessage` is a POCO that matches the structure of your serialized payload. The source will subscribe to the topic and emit deserialized objects into the stream.

### Customizing the consumer

You can pass a `ConsumerConfig` instance to override settings such as the `GroupId`, `AutoOffsetReset`, or authentication. You may also supply a custom deserializer implementing `IDeserializer<T>` to handle binary formats or Avro

## Kafka Sink Operator

`KafkaSinkOperator` publishes records to a Kafka topic. The constructor accepts the bootstrap server list, topic name and optional `ProducerConfig` and serializer. If no serializer is provided, JSON serialization is used.

### Example: Producing records

```csharp
using Cortex.Streams;
using Cortex.Streams.Kafka;

var sink = new KafkaSinkOperator<MyMessage>(
    bootstrapServers: "localhost:9092",
    topic: "my-topic");

var stream = StreamBuilder<MyMessage>
    .CreateNewStream("KafkaProducer")
    .Source()
    .Sink(sink)
    .Build();

stream.Start();

// Emit an object to send it to Kafka
stream.Emit(new MyMessage { Value = 42 });
```

## Serializers and deserializers

- **DefaultJsonSerializer** / **DefaultJsonDeserializer** – Serialize and deserialize JSON using `System.Text.Json`
- **DefaultBase64Serializer** / **DefaultBase64StringDeserializer** – Convert arbitrary binary data to/from `base64` (useful for opaque payloads).
- **DefaultProtobufSerializer** / **DefaultProtobufDeserializer** – Serialize Protocol Buffers messages.

You can implement your own `ISerializer<T>` or `IDeserializer<T>` and pass it to the operator.

## Error handling

The Kafka operators print errors to the console when delivery fails or when deserialization encounters invalid JSON. You can supply your own serializer to control error behaviour and integrate with dead‑letter topics.