---
title: Architecture Overview
description: Architecture Overview of Cortex Mediator
---

# Architecture Overview

This document provides a high-level overview of **Cortex.Mediator**'s architecture, design patterns, and how the components interact.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Application Layer"
        Controller[Controller / Service]
    end
    
    subgraph "Cortex.Mediator"
        Mediator[IMediator]
        
        subgraph "Pipeline"
            B1[Behavior 1<br/>Logging]
            B2[Behavior 2<br/>Validation]
            B3[Behavior 3<br/>Caching]
            B4[Behavior N<br/>Custom]
        end
        
        subgraph "Handlers"
            CH[Command Handlers]
            QH[Query Handlers]
            NH[Notification Handlers]
            SH[Stream Handlers]
        end
    end
    
    subgraph "Infrastructure"
        DB[(Database)]
        Cache[(Cache)]
        Queue[Message Queue]
        External[External Services]
    end
    
    Controller -->|Send/Query/Publish| Mediator
    Mediator --> B1
    B1 --> B2
    B2 --> B3
    B3 --> B4
    B4 --> CH
    B4 --> QH
    B4 --> NH
    B4 --> SH
    
    CH --> DB
    QH --> DB
    QH --> Cache
    NH --> Queue
    NH --> External
```

## Request Flow

```mermaid
sequenceDiagram
    participant C as Controller
    participant M as IMediator
    participant P as Pipeline Behaviors
    participant H as Handler
    participant R as Repository
    
    C->>M: SendAsync(command)
    M->>P: Execute Pipeline
    
    Note over P: Pre-processing<br/>(Logging, Validation)
    
    P->>H: Handle(command)
    H->>R: Database Operation
    R-->>H: Result
    H-->>P: Response
    
    Note over P: Post-processing<br/>(Caching, Metrics)
    
    P-->>M: Final Response
    M-->>C: Result
```

## Core Components

### 1. IMediator Interface

The central hub that routes requests to appropriate handlers.

```mermaid
classDiagram
    class IMediator {
        <<interface>>
        +SendCommandAsync~TCommand,TResult~(command) Task~TResult~
        +SendQueryAsync~TQuery,TResult~(query) Task~TResult~
        +PublishAsync~TNotification~(notification) Task
        +CreateStream~TQuery,TResult~(query) IAsyncEnumerable~TResult~
    }
    
    class Mediator {
        -IServiceProvider _serviceProvider
        +SendCommandAsync()
        +SendQueryAsync()
        +PublishAsync()
        +CreateStream()
    }
    
    IMediator <|.. Mediator
```

### 2. Commands, Queries, and Notifications

```mermaid
classDiagram
    class ICommand~TResult~ {
        <<interface>>
    }
    
    class IQuery~TResult~ {
        <<interface>>
    }
    
    class INotification {
        <<interface>>
    }
    
    class IStreamQuery~TResult~ {
        <<interface>>
    }
    
    class ICommandHandler~TCommand,TResult~ {
        <<interface>>
        +Handle(command, cancellationToken) Task~TResult~
    }
    
    class IQueryHandler~TQuery,TResult~ {
        <<interface>>
        +Handle(query, cancellationToken) Task~TResult~
    }
    
    class INotificationHandler~TNotification~ {
        <<interface>>
        +Handle(notification, cancellationToken) Task
    }
    
    class IStreamQueryHandler~TQuery,TResult~ {
        <<interface>>
        +Handle(query, cancellationToken) IAsyncEnumerable~TResult~
    }
    
    ICommand~TResult~ ..> ICommandHandler~TCommand,TResult~ : handled by
    IQuery~TResult~ ..> IQueryHandler~TQuery,TResult~ : handled by
    INotification ..> INotificationHandler~TNotification~ : handled by
    IStreamQuery~TResult~ ..> IStreamQueryHandler~TQuery,TResult~ : handled by
```

### 3. Pipeline Behaviors

```mermaid
graph LR
    subgraph "Pipeline Execution Order"
        direction LR
        A[Request] --> B[Exception Handling]
        B --> C[Logging]
        C --> D[Validation]
        D --> E[Caching]
        E --> F[Pre-Processor]
        F --> G[Handler]
        G --> H[Post-Processor]
        H --> I[Response]
    end
    
    style A fill:#e1f5fe
    style G fill:#c8e6c9
    style I fill:#e1f5fe
```

```mermaid
classDiagram
    class ICommandPipelineBehavior~TCommand,TResult~ {
        <<interface>>
        +Handle(command, next, cancellationToken) Task~TResult~
    }
    
    class IQueryPipelineBehavior~TQuery,TResult~ {
        <<interface>>
        +Handle(query, next, cancellationToken) Task~TResult~
    }
    
    class INotificationPipelineBehavior~TNotification~ {
        <<interface>>
        +Handle(notification, next, cancellationToken) Task
    }
    
    class LoggingCommandBehavior~TCommand,TResult~ {
        +Handle()
    }
    
    class ValidationCommandBehavior~TCommand,TResult~ {
        +Handle()
    }
    
    class CachingQueryBehavior~TQuery,TResult~ {
        +Handle()
    }
    
    class ExceptionHandlingBehavior~TCommand,TResult~ {
        +Handle()
    }
    
    ICommandPipelineBehavior <|.. LoggingCommandBehavior
    ICommandPipelineBehavior <|.. ValidationCommandBehavior
    ICommandPipelineBehavior <|.. ExceptionHandlingBehavior
    IQueryPipelineBehavior <|.. CachingQueryBehavior
```

## CQRS Pattern Implementation

```mermaid
graph TB
    subgraph "Write Side (Commands)"
        WC[Write Controller]
        CMD[Command]
        CH[Command Handler]
        WDB[(Write Database)]
        
        WC -->|Create/Update/Delete| CMD
        CMD --> CH
        CH -->|Persist| WDB
    end
    
    subgraph "Read Side (Queries)"
        RC[Read Controller]
        QRY[Query]
        QH[Query Handler]
        RDB[(Read Database / Cache)]
        
        RC -->|Get/Search/List| QRY
        QRY --> QH
        QH -->|Fetch| RDB
    end
    
    subgraph "Events"
        N[Notification]
        NH1[Handler 1]
        NH2[Handler 2]
        NH3[Handler 3]
        
        CH -->|Publish| N
        N --> NH1
        N --> NH2
        N --> NH3
    end
    
    style CMD fill:#ffcdd2
    style QRY fill:#c8e6c9
    style N fill:#fff9c4
```

## Notification Fan-Out Pattern

```mermaid
graph TD
    subgraph "Publisher"
        CMD[Command Handler]
    end
    
    subgraph "Mediator"
        M[IMediator]
        PUB[PublishAsync]
    end
    
    subgraph "Notification Handlers"
        N[UserRegisteredNotification]
        H1[Send Welcome Email]
        H2[Create User Profile]
        H3[Track Analytics]
        H4[Publish to Message Bus]
        H5[Update Search Index]
    end
    
    CMD -->|Publish| M
    M --> PUB
    PUB --> N
    N --> H1
    N --> H2
    N --> H3
    N --> H4
    N --> H5
    
    style N fill:#fff9c4
    style H1 fill:#e1f5fe
    style H2 fill:#e1f5fe
    style H3 fill:#e1f5fe
    style H4 fill:#e1f5fe
    style H5 fill:#e1f5fe
```

## Caching Architecture

```mermaid
graph TB
    subgraph "Query Flow with Caching"
        Q[Query Request]
        CB[Caching Behavior]
        Cache[(Memory Cache)]
        QH[Query Handler]
        DB[(Database)]
        
        Q --> CB
        CB -->|Check Cache| Cache
        Cache -->|Cache Hit| CB
        Cache -->|Cache Miss| QH
        QH --> DB
        DB --> QH
        QH -->|Store in Cache| Cache
        CB --> R[Response]
    end
    
    style Cache fill:#fff9c4
```

```mermaid
sequenceDiagram
    participant C as Client
    participant M as Mediator
    participant CB as CachingBehavior
    participant Cache as IMemoryCache
    participant H as QueryHandler
    participant DB as Database
    
    C->>M: QueryAsync(GetUserQuery)
    M->>CB: Handle(query)
    CB->>Cache: TryGetValue(cacheKey)
    
    alt Cache Hit
        Cache-->>CB: Cached Result
        CB-->>M: Return Cached
        M-->>C: Response
    else Cache Miss
        Cache-->>CB: null
        CB->>H: next()
        H->>DB: Fetch Data
        DB-->>H: Data
        H-->>CB: Result
        CB->>Cache: Set(cacheKey, result)
        CB-->>M: Return Fresh
        M-->>C: Response
    end
```

## Exception Handling Flow

```mermaid
graph TB
    subgraph "Exception Handling Pipeline"
        REQ[Request]
        EHB[Exception Handling Behavior]
        NEXT[Next Behavior / Handler]
        EH[IExceptionHandler]
        
        REQ --> EHB
        EHB -->|try| NEXT
        NEXT -->|success| RES[Response]
        NEXT -->|exception| EH
        EH -->|handled=true| FALLBACK[Fallback Result]
        EH -->|handled=false| RETHROW[Rethrow Exception]
    end
    
    style EHB fill:#ffcdd2
    style EH fill:#fff9c4
```

## Dependency Injection Structure

```mermaid
graph TB
    subgraph "Service Registration"
        SC[ServiceCollection]
        
        subgraph "Core Services"
            MED[IMediator → Mediator]
        end
        
        subgraph "Handlers (Auto-Discovered)"
            CH[ICommandHandler<,>]
            QH[IQueryHandler<,>]
            NH[INotificationHandler<>]
            SH[IStreamQueryHandler<,>]
        end
        
        subgraph "Behaviors (Ordered)"
            B1[ExceptionHandlingBehavior]
            B2[LoggingBehavior]
            B3[ValidationBehavior]
            B4[CachingBehavior]
        end
        
        subgraph "Optional Services"
            VAL[IValidator<>]
            CACHE[IMemoryCache]
            EXCEPT[IExceptionHandler]
        end
    end
    
    SC --> MED
    SC --> CH
    SC --> QH
    SC --> NH
    SC --> SH
    SC --> B1
    SC --> B2
    SC --> B3
    SC --> B4
    SC --> VAL
    SC --> CACHE
    SC --> EXCEPT
```

## Streaming Query Architecture

```mermaid
sequenceDiagram
    participant C as Consumer
    participant M as Mediator
    participant H as StreamHandler
    participant DB as Database
    
    C->>M: StreamAsync(query)
    M->>H: Handle(query)
    
    loop For Each Record
        H->>DB: Fetch Next Batch
        DB-->>H: Records
        H-->>M: yield return item
        M-->>C: await foreach item
        Note over C: Process item immediately
    end
    
    H-->>M: Stream Complete
    M-->>C: Enumeration Complete
```

## Vertical Slice Architecture

```mermaid
graph TB
    subgraph "Feature: Create Order"
        CO_CMD[CreateOrderCommand]
        CO_HDL[CreateOrderHandler]
        CO_VAL[CreateOrderValidator]
        CO_NOT[OrderCreatedNotification]
    end
    
    subgraph "Feature: Get Order"
        GO_QRY[GetOrderQuery]
        GO_HDL[GetOrderHandler]
    end
    
    subgraph "Feature: Update Order"
        UO_CMD[UpdateOrderCommand]
        UO_HDL[UpdateOrderHandler]
        UO_VAL[UpdateOrderValidator]
    end
    
    subgraph "Shared Infrastructure"
        REPO[IOrderRepository]
        DB[(Database)]
    end
    
    CO_HDL --> REPO
    GO_HDL --> REPO
    UO_HDL --> REPO
    REPO --> DB
    
    CO_HDL -->|Publish| CO_NOT
```

## Request Types Comparison

| Aspect | Command | Query | Notification | Stream Query |
|--------|---------|-------|--------------|--------------|
| **Purpose** | Change state | Read data | Broadcast event | Stream large data |
| **Return Value** | Optional | Required | None | IAsyncEnumerable |
| **Handlers** | Exactly one | Exactly one | Zero or more | Exactly one |
| **Side Effects** | Yes | No | Yes | No |
| **Cacheable** | No | Yes | No | No |
| **Example** | CreateOrder | GetOrderById | OrderCreated | ExportAllOrders |

## Design Principles

### Single Responsibility
Each handler does one thing and does it well.

```mermaid
graph LR
    subgraph "Good: Single Responsibility"
        A[CreateUserCommand] --> B[CreateUserHandler]
        C[SendWelcomeEmail] --> D[EmailHandler]
        E[TrackAnalytics] --> F[AnalyticsHandler]
    end
```

### Open/Closed Principle
Add new features without modifying existing code.

```mermaid
graph TB
    subgraph "Extensible via Behaviors"
        M[Mediator]
        B1[Existing Behavior 1]
        B2[Existing Behavior 2]
        B3[New Custom Behavior]
        H[Handler]
        
        M --> B1
        B1 --> B2
        B2 --> B3
        B3 --> H
    end
    
    style B3 fill:#c8e6c9
```

## Performance Considerations

```mermaid
graph TB
    subgraph "Performance Optimizations"
        direction TB
        
        subgraph "Caching"
            C1[Query Results]
            C2[Computed Values]
        end
        
        subgraph "Streaming"
            S1[Large Datasets]
            S2[Export Operations]
        end
        
        subgraph "Async/Await"
            A1[Non-blocking I/O]
            A2[Parallel Notifications]
        end
        
        subgraph "Handler Lifetime"
            H1[Transient Handlers]
            H2[Scoped Dependencies]
        end
    end
```
