---
title: Transactional Behaviors
description: Transactional Behaviors of Cortex Mediator
---

## Overview

**Cortex.Mediator.Behaviors.Transactional** provides transactional pipeline behaviors for the Cortex.Mediator library. It enables automatic transaction management for command execution, ensuring data consistency with automatic commit on success and rollback on failure.

[![NuGet Version](https://img.shields.io/nuget/v/Cortex.Mediator.Behaviors.Transactional?label=Cortex.Mediator.Behaviors.Transactional)](https://www.nuget.org/packages/Cortex.Mediator.Behaviors.Transactional)

## Features

- **Automatic Transaction Management**: Wraps command execution in a transaction scope
- **Async Support**: Full support for async/await patterns with `TransactionScopeAsyncFlowOption`
- **Configurable Isolation Levels**: Support for all standard transaction isolation levels
- **Custom Transaction Contexts**: Integrate with Entity Framework, Dapper, or any custom ORM
- **Selective Exclusion**: Exclude specific commands from transactional behavior via attributes or configuration
- **Fluent Configuration**: Easy-to-use fluent API for configuration

## Installation

Install via NuGet Package Manager:

```bash
dotnet add package Cortex.Mediator.Behaviors.Transactional
```

Or via Package Manager Console:

```powershell
Install-Package Cortex.Mediator.Behaviors.Transactional
```

## Quick Start

### Basic Setup

```csharp
using Cortex.Mediator.DependencyInjection;
using Cortex.Mediator.Behaviors.Transactional.DependencyInjection;

// In your Startup.cs or Program.cs
services.AddMediator(options =>
{
    options.RegisterServicesFromAssembly(typeof(Program).Assembly);
    
    // Add transactional behaviors
    options.AddTransactionalBehaviors();
});

// Register transactional options
services.AddTransactionalBehavior();
```

### With Custom Options

```csharp
services.AddTransactionalBehavior(options =>
{
    options.IsolationLevel = IsolationLevel.Serializable;
    options.Timeout = TimeSpan.FromMinutes(2);
    options.ScopeOption = TransactionScopeOption.RequiresNew;
});
```

## Usage Examples

### Basic Command Execution

Once configured, all commands automatically execute within a transaction:

```csharp
// Define a command
public class CreateOrderCommand : ICommand<OrderResult>
{
    public string CustomerId { get; set; }
    public List<OrderItem> Items { get; set; }
}

// Command handler
public class CreateOrderCommandHandler : ICommandHandler<CreateOrderCommand, OrderResult>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IInventoryService _inventoryService;

    public CreateOrderCommandHandler(
        IOrderRepository orderRepository,
        IInventoryService inventoryService)
    {
        _orderRepository = orderRepository;
        _inventoryService = inventoryService;
    }

    public async Task<OrderResult> Handle(
        CreateOrderCommand command,
        CancellationToken cancellationToken)
    {
        // All operations within this handler are transactional
        var order = await _orderRepository.CreateAsync(command.CustomerId);
        
        foreach (var item in command.Items)
        {
            await _inventoryService.ReserveAsync(item.ProductId, item.Quantity);
            await _orderRepository.AddItemAsync(order.Id, item);
        }

        // Transaction commits automatically if no exception is thrown
        // Transaction rolls back automatically if any exception occurs
        return new OrderResult { OrderId = order.Id };
    }
}
```

### Excluding Commands from Transactions

#### Using the NonTransactional Attribute

```csharp
[NonTransactional]
public class ReadOnlyQuery : ICommand<IEnumerable<Product>>
{
    public string SearchTerm { get; set; }
}
```

#### Using Configuration

```csharp
services.AddTransactionalBehavior(options =>
{
    // Exclude specific command types
    options.ExcludeCommand<ReadOnlyQuery>();
    
    // Or exclude multiple at once
    options.ExcludeCommands(
        typeof(ReadOnlyQuery),
        typeof(CacheRefreshCommand),
        typeof(LoggingCommand)
    );
});
```

### Custom Transaction Context

For more control over transaction management (e.g., with Entity Framework):

#### 1. Implement ITransactionalContext

```csharp
public class EfCoreTransactionalContext : ITransactionalContext
{
    private readonly DbContext _dbContext;
    private IDbContextTransaction _transaction;

    public EfCoreTransactionalContext(DbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        _transaction = await _dbContext.Database
            .BeginTransactionAsync(cancellationToken);
    }

    public async Task CommitAsync(CancellationToken cancellationToken = default)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _transaction.CommitAsync(cancellationToken);
    }

    public async Task RollbackAsync(CancellationToken cancellationToken = default)
    {
        await _transaction.RollbackAsync(cancellationToken);
    }
}
```

#### 2. Register the Custom Context

```csharp
services.AddTransactionalBehavior();
services.AddTransactionalContext<EfCoreTransactionalContext>();
```

Or with a factory:

```csharp
services.AddTransactionalContext(sp => 
    new EfCoreTransactionalContext(sp.GetRequiredService<MyDbContext>()));
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `IsolationLevel` | `ReadCommitted` | Transaction isolation level |
| `Timeout` | `30 seconds` | Transaction timeout duration |
| `ScopeOption` | `Required` | Determines how the transaction scope behaves |
| `AsyncFlowOption` | `Enabled` | Enables async flow for TransactionScope |
| `ExcludedCommandTypes` | `Empty` | Set of command types to exclude from transactions |

### Isolation Levels

```csharp
services.AddTransactionalBehavior(options =>
{
    // Choose the appropriate isolation level for your use case
    options.IsolationLevel = IsolationLevel.ReadCommitted;     // Default
    // options.IsolationLevel = IsolationLevel.ReadUncommitted;
    // options.IsolationLevel = IsolationLevel.RepeatableRead;
    // options.IsolationLevel = IsolationLevel.Serializable;
    // options.IsolationLevel = IsolationLevel.Snapshot;
});
```

### Transaction Scope Options

```csharp
services.AddTransactionalBehavior(options =>
{
    // Required: Join existing or create new (default)
    options.ScopeOption = TransactionScopeOption.Required;
    
    // RequiresNew: Always create a new transaction
    // options.ScopeOption = TransactionScopeOption.RequiresNew;
    
    // Suppress: Execute without a transaction
    // options.ScopeOption = TransactionScopeOption.Suppress;
});
```

## Pipeline Behavior Order

When using multiple pipeline behaviors, consider the order of registration:

```csharp
services.AddMediator(options =>
{
    options.RegisterServicesFromAssembly(typeof(Program).Assembly);
    
    // Recommended order:
    // 1. Validation (fail fast before transaction starts)
    options.AddFluentValidationBehaviors();
    
    // 2. Transaction (wrap the actual execution)
    options.AddTransactionalBehaviors();
    
    // 3. Logging (optional, for debugging)
    // options.AddLoggingBehaviors();
});
```

## Error Handling

### Automatic Rollback

If any exception occurs during command execution, the transaction is automatically rolled back:

```csharp
public class TransferMoneyCommandHandler : ICommandHandler<TransferMoneyCommand>
{
    public async Task Handle(TransferMoneyCommand command, CancellationToken ct)
    {
        await _accountService.DebitAsync(command.FromAccountId, command.Amount);
        
        // If this throws, the debit above is rolled back
        await _accountService.CreditAsync(command.ToAccountId, command.Amount);
    }
}
```

### Transaction Exception

The library includes a `TransactionException` for specific transaction-related errors:

```csharp
try
{
    await mediator.Send(command);
}
catch (TransactionException ex) when (ex.FailureType == TransactionFailureType.Timeout)
{
    // Handle timeout specifically
    _logger.LogError("Transaction timed out: {Message}", ex.Message);
}
```

## Best Practices

### 1. Keep Transactions Short

```csharp
// ? Good: Transaction only wraps database operations
public async Task<Result> Handle(Command command, CancellationToken ct)
{
    await _repository.SaveAsync(entity);
    return Result.Success();
}

// ? Avoid: Long-running operations inside transactions
public async Task<Result> Handle(Command command, CancellationToken ct)
{
    await _repository.SaveAsync(entity);
    await _emailService.SendAsync(email);  // External service call
    await Task.Delay(5000);                // Artificial delay
    return Result.Success();
}
```

### 2. Exclude Read-Only Operations

```csharp
[NonTransactional]
public class GetProductsQuery : ICommand<IEnumerable<Product>>
{
    // Read-only queries don't need transaction overhead
}
```

### 3. Use Appropriate Isolation Levels

```csharp
// For high-throughput read scenarios
options.IsolationLevel = IsolationLevel.ReadCommitted;

// For financial transactions requiring strict consistency
options.IsolationLevel = IsolationLevel.Serializable;
```

### 4. Set Appropriate Timeouts

```csharp
// For quick operations
options.Timeout = TimeSpan.FromSeconds(15);

// For complex batch operations
options.Timeout = TimeSpan.FromMinutes(5);
```

## Integration Examples

### With Entity Framework Core

```csharp
public class EfCoreTransactionalContext : ITransactionalContext
{
    private readonly ApplicationDbContext _context;
    private IDbContextTransaction _transaction;

    public EfCoreTransactionalContext(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task BeginTransactionAsync(CancellationToken ct = default)
    {
        _transaction = await _context.Database.BeginTransactionAsync(ct);
    }

    public async Task CommitAsync(CancellationToken ct = default)
    {
        await _context.SaveChangesAsync(ct);
        await _transaction.CommitAsync(ct);
    }

    public async Task RollbackAsync(CancellationToken ct = default)
    {
        await _transaction.RollbackAsync(ct);
    }
}

// Registration
services.AddDbContext<ApplicationDbContext>();
services.AddTransactionalBehavior();
services.AddTransactionalContext<EfCoreTransactionalContext>();
```

### With Dapper

```csharp
public class DapperTransactionalContext : ITransactionalContext
{
    private readonly IDbConnection _connection;
    private IDbTransaction _transaction;

    public DapperTransactionalContext(IDbConnection connection)
    {
        _connection = connection;
    }

    public Task BeginTransactionAsync(CancellationToken ct = default)
    {
        if (_connection.State != ConnectionState.Open)
            _connection.Open();
        
        _transaction = _connection.BeginTransaction();
        return Task.CompletedTask;
    }

    public Task CommitAsync(CancellationToken ct = default)
    {
        _transaction.Commit();
        return Task.CompletedTask;
    }

    public Task RollbackAsync(CancellationToken ct = default)
    {
        _transaction.Rollback();
        return Task.CompletedTask;
    }
}
```

## Troubleshooting

### Transaction Not Working with Async Methods

Ensure `AsyncFlowOption` is enabled (default):

```csharp
services.AddTransactionalBehavior(options =>
{
    options.AsyncFlowOption = TransactionScopeAsyncFlowOption.Enabled;
});
```

### Distributed Transactions

For distributed transactions across multiple databases, ensure MSDTC is configured properly on your system, or use a custom `ITransactionalContext` that coordinates multiple connections.

### Performance Considerations

- Use `ReadCommitted` isolation level for most scenarios
- Exclude read-only queries from transactions
- Keep transaction scope as small as possible
- Consider using `RequiresNew` scope option for independent operations