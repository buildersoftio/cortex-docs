---
title: Aggregations Overview
description: An overview of Aggregations in Cortex Streams
---


Aggregation involves grouping records by a certain key and then applying an aggregate function over the grouped data. This is useful when you want to compute summary statistics, maintain running totals, or build complex stateful transformations from event streams.

## Common Use Cases

* Counting the number of events per key.
* Summing values per key.
* Maintaining rolling averages, minimums, or maximums.
* Building complex states, such as consolidating multiple Customer events (e.g., profile updates, purchases) into a single "customer state" object.

## GroupBy and Aggregate Operators
**GroupBy**: Splits the stream into keyed groups based on a provided key selector. Internally, it uses a state store to maintain a list of events for each key.

**Aggregate**: Consumes grouped data and applies an aggregation function to produce a single result (or ongoing results) per key. The aggregator uses a state store to maintain intermediate results.

The streaming API supports two modes:

* **GroupBy / Aggregate (Emitting)**: The resulting stream will emit `KeyValuePair<TKey, Aggregate>` objects whenever new data arrives.
* **GroupBySilently / AggregateSilently (Silent)**: The state is maintained silently without emitting grouped or aggregated results directly. The data continues down the pipeline in its original form, but the aggregator updates its state store behind the scenes. This is useful when you want to keep track of state but not necessarily produce aggregated output at every step.


