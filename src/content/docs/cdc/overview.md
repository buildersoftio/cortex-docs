---
title: Change Data Capture Overview
description: An overview of Change data capture in Cortex Data Framework
---

**Change Data Capture (CDC)** is a critical pattern in modern data streaming systems that allows applications to react to changes (insert, update, delete) in data sources in real-time. Within the Cortex streaming framework, CDC is implemented as a source operator that integrates with various database systems to capture and emit change events into a stream processing pipeline.

Cortex is designed to support CDC from multiple systems such as Microsoft SQL Server, PostgreSQL, MongoDB, etc. Cortex implements CDC through specialized Source Operators that connect to databases, detect changes, and emit them as stream events for downstream processing.

## What is Change Data Capture?

Change Data Capture is a design pattern that enables the capture and tracking of changes in a data store. By monitoring data modifications:

- **CDC captures inserts, updates, and deletes** on tables.
- **It emits change events** that can be processed by downstream applications in near real-time.
- **It supports use cases** like real-time analytics, data replication, synchronization between heterogeneous systems, and event-driven architectures.

## CDC in Cortex: General Overview

Cortex implements CDC as part of its streaming framework through specialized source operators. These operators:

- Connect to specific data sources.
- Detect and capture changes as they occur.
- Emit change events into the Cortex stream for further processing, such as filtering, mapping, aggregation, or routing to sinks.

### Key Features of Cortex CDC Operators

- **Real-Time Ingestion**: Captures and streams data changes as they occur in the source system.
- **Optional Initial Load**: Optionally performs a one-time full read of the target data before streaming incremental changes.
- **Stateful Processing**: Maintains checkpointing and state to ensure exactly-once or at-least-once processing semantics.
- **Duplicate Handling**: Implements mechanisms such as record hashing to filter out duplicate events.
- **Telemetry Integration**: Provides observability through integrated metrics and tracing.
- **Modular Design**: The architecture allows for easy extension to support additional systems like PostgreSQL, MongoDB, Oracle, etc.
