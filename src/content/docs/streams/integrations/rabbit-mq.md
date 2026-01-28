---
title: RabbitMQ
description: How to integrate RabbitMQ in Cortex.Streams
---

The **Cortex.Streams.RabbitMQ** package provides source and sink operators for [RabbitMQ](https://www.rabbitmq.com/). These operators wrap the official `RabbitMQ.Client` library and expose an easy way to publish messages to or consume messages from queues using the **Cortex Streams**.

## Installation

Add the NuGet package:

```csharp
dotnet add package Cortex.Streams.RabbitMQ
```

## RabbitMQ Source Operator

Use `RabbitMQSourceOperator` when you want to consume messages from a RabbitMQ queue. The constructor accepts the server hostname and queue name, plus optional credentials and a custom deserializer. If no deserializer is provided, the operator deserializes JSON by default. During initialization the operator creates a connection and channel and declares the queue as durable, non‑exclusive and non‑auto‑delete.

When `Start` is invoked, an `EventingBasicConsumer` is attached to the channel. Incoming messages are decoded from UTF‑8, deserialized and emitted into the stream. Messages are acknowledged only after the user-provided emit action completes, enabling “at least once” semantics. If processing fails, the message is negatively acknowledged and can be routed to a dead‑letter queue.

### Example: Consuming from RabbitMQ

```csharp
using Cortex.Streams;
using Cortex.Streams.RabbitMQ;

var source = new RabbitMQSourceOperator<MyMessage>(
    hostname: "localhost",
    queueName: "orders",
    username: "guest",
    password: "guest");

var stream = StreamBuilder<MyMessage>
    .CreateNewStream("RabbitConsumer")
    .Source(source)
    .Sink(msg => Console.WriteLine($"Received order {msg.Id}"))
    .Build();

stream.Start();
```

### Customizing the consumer
If your messages are encoded differently (e.g., binary or Avro), implement `IDeserializer<T>`and pass it to the operator. The deserializer receives the message body as a string and returns an instance of T. You can also change queue properties (durability, exchange) by modifying the `RabbitMQ.Client` call before creating the operator.

## RabbitMQ Sink Operator
`RabbitMQSinkOperator` publishes records to a RabbitMQ queue. The constructor accepts the hostname and queue name, optional credentials and an optional serializer. When no serializer is provided, the operator uses a default JSON serializer. Upon construction it opens a connection and channel and declares the target queue with `durable=true`.

The `Process` method serializes each record to UTF‑8 bytes and uses `BasicPublish` with persistent message properties so that messages are saved to disk. Messages are published asynchronously in a background task and errors are logged to the console.

### Example: Producing to RabbitMQ
```csharp
using Cortex.Streams;
using Cortex.Streams.RabbitMQ;

var sink = new RabbitMQSinkOperator<MyMessage>(
    hostname: "localhost",
    queueName: "orders");

var stream = StreamBuilder<MyMessage>
    .CreateNewStream("RabbitProducer")
    .Source()
    .Sink(sink)
    .Build();

stream.Start();

// Emit a message to RabbitMQ
stream.Emit(new MyMessage { Id = 42, Product = "apple" });
```

## Serializers and deserializers

By default the RabbitMQ operators convert objects to/from JSON. To use a different format (e.g., Protocol Buffers), implement `ISerializer<T>` and `IDeserializer<T>` and pass them to the sink or source constructor.

## Error handling
The operators wrap network operations in try/catch blocks. When publishing, exceptions are logged and you can implement a retry or dead‑letter queue strategy. On the consumer side, message processing errors are caught and the message is negatively acknowledged so it can be retried or moved to a dead‑letter queue.
