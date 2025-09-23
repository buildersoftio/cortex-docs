---
title: Best Practices for CDC Operators
description: An overview of Best Practices for CDC Operators in Cortex Data Framework
---

## General Best Practices for CDC Operators

1. Persistent State Stores
- In production, always use a reliable persistent IDataStore (e.g., RocksDB, or another external store) so checkpoints survive application restarts.
2. Sensible Polling or Streaming Intervals
- Database load and latency requirements vary. Tweak PullInterval or the equivalent delay/timeout for your environment.
3. Deduplication Logic
- The built-in hash-based mechanism prevents accidentally re-emitting the same record. Ensure unique or stable column sets for hashing.
4. Security & Permissions
- Each database user must have privileges to enable or read CDC. Secure your credentials and follow least-privilege guidelines.
5. Monitoring & Alerting
- Monitor for lag or errors. In high-throughput systems, ensure operators keep up with the volume of changes and that logs are properly captured.
6. Transaction Log / WAL Management
- For SQL Server and PostgreSQL, keep an eye on transaction log or WAL usage. For MongoDB, monitor oplog retention and size.
7. Testing & Validation
- Thoroughly test with simulated or real workloads before production. Validate that initial loads and incremental changes match your data expectations.