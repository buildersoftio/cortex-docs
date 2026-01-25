---
title: Streaming Queries
description: Streaming Queries with Cortex.Mediator
---

# Streaming Queries

Streaming queries allow you to handle large datasets efficiently using `IAsyncEnumerable<T>`, returning results one at a time without loading everything into memory. This is perfect for processing large collections, real-time data feeds, or paginated results.

## What are Streaming Queries?

Traditional queries load all results into memory before returning:
```csharp
// Traditional - loads all 1 million records into memory
List<UserDto> users = await mediator.QueryAsync(new GetAllUsersQuery());
```

Streaming queries yield results one at a time:
```csharp
// Streaming - processes one record at a time
await foreach (var user in mediator.StreamAsync(new GetAllUsersQuery()))
{
    ProcessUser(user); // Memory efficient!
}
```

## Benefits

- ? **Memory Efficient** - Process large datasets without memory issues
- ? **Faster First Result** - Start processing immediately
- ? **Cancellation Support** - Stop early if needed
- ? **Real-time Processing** - Handle data as it arrives
- ? **Scalable** - Handle datasets of any size

## Creating Streaming Queries

### Basic Streaming Query

```csharp
using Cortex.Mediator.Streaming;

public class GetAllUsersQuery : IStreamQuery<UserDto>
{
    public int BatchSize { get; set; } = 100;
}

public class UserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; }
    public string Name { get; set; }
}
```

### Streaming Query with Filters

```csharp
public class StreamActiveUsersQuery : IStreamQuery<UserDto>
{
    public DateTime? RegisteredAfter { get; set; }
    public string Department { get; set; }
    public int BatchSize { get; set; } = 50;
}
```

## Implementing Streaming Query Handlers

### Basic Handler

```csharp
using Cortex.Mediator.Streaming;
using System.Runtime.CompilerServices;

public class GetAllUsersQueryHandler : IStreamQueryHandler<GetAllUsersQuery, UserDto>
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<GetAllUsersQueryHandler> _logger;

    public GetAllUsersQueryHandler(
        ApplicationDbContext context,
        ILogger<GetAllUsersQueryHandler> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async IAsyncEnumerable<UserDto> Handle(
        GetAllUsersQuery query,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting to stream users");

        var users = _context.Users
            .AsNoTracking()
            .OrderBy(u => u.Id);

        await foreach (var user in users.AsAsyncEnumerable().WithCancellation(cancellationToken))
        {
            yield return new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                Name = $"{user.FirstName} {user.LastName}"
            };
        }

        _logger.LogInformation("Finished streaming users");
    }
}
```

### Handler with Batching

```csharp
public class StreamOrdersQueryHandler : IStreamQueryHandler<StreamOrdersQuery, OrderDto>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<StreamOrdersQueryHandler> _logger;

    public StreamOrdersQueryHandler(
        IOrderRepository orderRepository,
        ILogger<StreamOrdersQueryHandler> logger)
    {
        _orderRepository = orderRepository;
        _logger = logger;
    }

    public async IAsyncEnumerable<OrderDto> Handle(
        StreamOrdersQuery query,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var skip = 0;
        var batchSize = query.BatchSize;
        var hasMore = true;

        while (hasMore && !cancellationToken.IsCancellationRequested)
        {
            _logger.LogDebug("Fetching orders batch: skip={Skip}, take={Take}", skip, batchSize);

            var orders = await _orderRepository.GetOrdersBatchAsync(
                skip,
                batchSize,
                cancellationToken);

            hasMore = orders.Count == batchSize;

            foreach (var order in orders)
            {
                yield return new OrderDto
                {
                    Id = order.Id,
                    CustomerName = order.CustomerName,
                    TotalAmount = order.TotalAmount,
                    OrderDate = order.OrderDate
                };
            }

            skip += batchSize;
        }

        _logger.LogInformation("Finished streaming orders");
    }
}
```

### Handler with Filters and Projections

```csharp
public class StreamProductsQuery : IStreamQuery<ProductDto>
{
    public string Category { get; set; }
    public decimal? MinPrice { get; set; }
    public bool? InStock { get; set; }
}

public class StreamProductsQueryHandler : IStreamQueryHandler<StreamProductsQuery, ProductDto>
{
    private readonly ApplicationDbContext _context;

    public StreamProductsQueryHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public async IAsyncEnumerable<ProductDto> Handle(
        StreamProductsQuery query,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var productsQuery = _context.Products
            .AsNoTracking()
            .AsQueryable();

        // Apply filters
        if (!string.IsNullOrEmpty(query.Category))
        {
            productsQuery = productsQuery.Where(p => p.Category == query.Category);
        }

        if (query.MinPrice.HasValue)
        {
            productsQuery = productsQuery.Where(p => p.Price >= query.MinPrice.Value);
        }

        if (query.InStock.HasValue)
        {
            productsQuery = productsQuery.Where(p => p.StockQuantity > 0 == query.InStock.Value);
        }

        // Stream results
        await foreach (var product in productsQuery.AsAsyncEnumerable().WithCancellation(cancellationToken))
        {
            yield return new ProductDto
            {
                Id = product.Id,
                Name = product.Name,
                Price = product.Price,
                Category = product.Category,
                InStock = product.StockQuantity > 0
            };
        }
    }
}
```

## Consuming Streaming Queries

### Basic Consumption

```csharp
public class DataExportService
{
    private readonly IMediator _mediator;

    public DataExportService(IMediator mediator)
    {
        _mediator = mediator;
    }

    public async Task ExportUsersAsync(string filePath)
    {
        var query = new GetAllUsersQuery { BatchSize = 100 };

        await using var writer = new StreamWriter(filePath);
        await writer.WriteLineAsync("Id,Email,Name"); // CSV header

        await foreach (var user in _mediator.StreamAsync(query))
        {
            await writer.WriteLineAsync($"{user.Id},{user.Email},{user.Name}");
        }
    }
}
```

### With Progress Tracking

```csharp
public async Task ProcessUsersWithProgressAsync()
{
    var query = new GetAllUsersQuery();
    var processedCount = 0;

    await foreach (var user in _mediator.StreamAsync(query))
    {
        // Process user
        await ProcessUserAsync(user);

        processedCount++;
        if (processedCount % 100 == 0)
        {
            Console.WriteLine($"Processed {processedCount} users...");
        }
    }

    Console.WriteLine($"Completed! Total processed: {processedCount}");
}
```

### With Cancellation

```csharp
public async Task StreamWithCancellationAsync()
{
    var cts = new CancellationTokenSource();
    cts.CancelAfter(TimeSpan.FromMinutes(5)); // Auto-cancel after 5 minutes

    try
    {
        await foreach (var user in _mediator.StreamAsync(new GetAllUsersQuery(), cts.Token))
        {
            await ProcessUserAsync(user);

            // Stop if condition met
            if (ShouldStop(user))
            {
                cts.Cancel();
                break;
            }
        }
    }
    catch (OperationCanceledException)
    {
        Console.WriteLine("Stream was cancelled");
    }
}
```

### Processing in Parallel

```csharp
public async Task ProcessUsersInParallelAsync()
{
    var query = new GetAllUsersQuery();
    var channel = Channel.CreateUnbounded<UserDto>();

    // Producer: stream from database
    _ = Task.Run(async () =>
    {
        try
        {
            await foreach (var user in _mediator.StreamAsync(query))
            {
                await channel.Writer.WriteAsync(user);
            }
        }
        finally
        {
            channel.Writer.Complete();
        }
    });

    // Consumers: process in parallel
    var tasks = Enumerable.Range(0, 5).Select(async _ =>
    {
        await foreach (var user in channel.Reader.ReadAllAsync())
        {
            await ProcessUserAsync(user);
        }
    });

    await Task.WhenAll(tasks);
}
```

## Real-World Examples

### Example 1: CSV Export

```csharp
// Query
public class ExportOrdersQuery : IStreamQuery<OrderExportDto>
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
}

public class OrderExportDto
{
    public string OrderId { get; set; }
    public string CustomerName { get; set; }
    public string CustomerEmail { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTime OrderDate { get; set; }
    public string Status { get; set; }
}

// Handler
public class ExportOrdersQueryHandler : IStreamQueryHandler<ExportOrdersQuery, OrderExportDto>
{
    private readonly ApplicationDbContext _context;

    public ExportOrdersQueryHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public async IAsyncEnumerable<OrderExportDto> Handle(
        ExportOrdersQuery query,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var orders = _context.Orders
            .AsNoTracking()
            .Where(o => o.OrderDate >= query.StartDate && o.OrderDate <= query.EndDate)
            .OrderBy(o => o.OrderDate);

        await foreach (var order in orders.AsAsyncEnumerable().WithCancellation(cancellationToken))
        {
            yield return new OrderExportDto
            {
                OrderId = order.Id.ToString(),
                CustomerName = order.CustomerName,
                CustomerEmail = order.CustomerEmail,
                TotalAmount = order.TotalAmount,
                OrderDate = order.OrderDate,
                Status = order.Status.ToString()
            };
        }
    }
}

// Service
public class OrderExportService
{
    private readonly IMediator _mediator;
    private readonly ILogger<OrderExportService> _logger;

    public OrderExportService(IMediator mediator, ILogger<OrderExportService> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    public async Task<string> ExportOrdersToCsvAsync(
        DateTime startDate,
        DateTime endDate,
        CancellationToken cancellationToken = default)
    {
        var fileName = $"orders_{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
        var filePath = Path.Combine(Path.GetTempPath(), fileName);

        _logger.LogInformation("Exporting orders to {FilePath}", filePath);

        var query = new ExportOrdersQuery
        {
            StartDate = startDate,
            EndDate = endDate
        };

        await using var writer = new StreamWriter(filePath);
        
        // Write header
        await writer.WriteLineAsync("OrderId,CustomerName,CustomerEmail,TotalAmount,OrderDate,Status");

        var count = 0;
        await foreach (var order in _mediator.StreamAsync(query, cancellationToken))
        {
            await writer.WriteLineAsync(
                $"{order.OrderId},{order.CustomerName},{order.CustomerEmail}," +
                $"{order.TotalAmount:F2},{order.OrderDate:yyyy-MM-dd},{order.Status}");

            count++;
            if (count % 1000 == 0)
            {
                _logger.LogInformation("Exported {Count} orders...", count);
            }
        }

        _logger.LogInformation("Export completed. Total orders: {Count}", count);

        return filePath;
    }
}
```

### Example 2: Data Migration

```csharp
// Query
public class StreamLegacyUsersQuery : IStreamQuery<LegacyUserDto>
{
    // No parameters needed - streams all users
}

// Handler
public class StreamLegacyUsersQueryHandler 
    : IStreamQueryHandler<StreamLegacyUsersQuery, LegacyUserDto>
{
    private readonly LegacyDbContext _legacyContext;

    public StreamLegacyUsersQueryHandler(LegacyDbContext legacyContext)
    {
        _legacyContext = legacyContext;
    }

    public async IAsyncEnumerable<LegacyUserDto> Handle(
        StreamLegacyUsersQuery query,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var users = _legacyContext.Users
            .AsNoTracking()
            .OrderBy(u => u.Id);

        await foreach (var user in users.AsAsyncEnumerable().WithCancellation(cancellationToken))
        {
            yield return new LegacyUserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                FullName = user.FullName,
                CreatedDate = user.CreatedDate
            };
        }
    }
}

// Migration Service
public class UserMigrationService
{
    private readonly IMediator _mediator;
    private readonly IUserRepository _newUserRepository;
    private readonly ILogger<UserMigrationService> _logger;

    public UserMigrationService(
        IMediator mediator,
        IUserRepository newUserRepository,
        ILogger<UserMigrationService> logger)
    {
        _mediator = mediator;
        _newUserRepository = newUserRepository;
        _logger = logger;
    }

    public async Task<MigrationResult> MigrateUsersAsync(CancellationToken cancellationToken)
    {
        var result = new MigrationResult();
        var query = new StreamLegacyUsersQuery();

        _logger.LogInformation("Starting user migration...");

        await foreach (var legacyUser in _mediator.StreamAsync(query, cancellationToken))
        {
            try
            {
                var newUser = new User
                {
                    Id = Guid.NewGuid(),
                    Email = legacyUser.Email,
                    UserName = legacyUser.Username,
                    FullName = legacyUser.FullName,
                    CreatedAt = legacyUser.CreatedDate,
                    MigratedFromId = legacyUser.Id
                };

                await _newUserRepository.AddAsync(newUser, cancellationToken);
                result.SuccessCount++;

                if (result.SuccessCount % 100 == 0)
                {
                    await _newUserRepository.SaveChangesAsync(cancellationToken);
                    _logger.LogInformation("Migrated {Count} users...", result.SuccessCount);
                }
            }
            catch (Exception ex)
            {
                result.FailureCount++;
                result.Errors.Add($"Failed to migrate user {legacyUser.Id}: {ex.Message}");
                _logger.LogError(ex, "Error migrating user {UserId}", legacyUser.Id);
            }
        }

        await _newUserRepository.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Migration completed. Success: {Success}, Failures: {Failures}",
            result.SuccessCount,
            result.FailureCount);

        return result;
    }
}

public class MigrationResult
{
    public int SuccessCount { get; set; }
    public int FailureCount { get; set; }
    public List<string> Errors { get; set; } = new();
}
```

### Example 3: Real-time Log Streaming

```csharp
// Query
public class StreamApplicationLogsQuery : IStreamQuery<LogEntryDto>
{
    public DateTime? Since { get; set; }
    public string Level { get; set; }
    public string Source { get; set; }
}

// Handler
public class StreamApplicationLogsQueryHandler 
    : IStreamQueryHandler<StreamApplicationLogsQuery, LogEntryDto>
{
    private readonly ILogRepository _logRepository;

    public StreamApplicationLogsQueryHandler(ILogRepository logRepository)
    {
        _logRepository = logRepository;
    }

    public async IAsyncEnumerable<LogEntryDto> Handle(
        StreamApplicationLogsQuery query,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var since = query.Since ?? DateTime.UtcNow.AddHours(-1);

        await foreach (var log in _logRepository.StreamLogsAsync(
            since,
            query.Level,
            query.Source,
            cancellationToken))
        {
            yield return new LogEntryDto
            {
                Timestamp = log.Timestamp,
                Level = log.Level,
                Message = log.Message,
                Source = log.Source,
                Exception = log.Exception
            };
        }
    }
}

// Real-time viewer API
[ApiController]
[Route("api/logs")]
public class LogsController : ControllerBase
{
    private readonly IMediator _mediator;

    public LogsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("stream")]
    public async Task StreamLogs(
        [FromQuery] DateTime? since,
        [FromQuery] string level,
        [FromQuery] string source,
        CancellationToken cancellationToken)
    {
        Response.Headers.Add("Content-Type", "text/event-stream");
        Response.Headers.Add("Cache-Control", "no-cache");
        Response.Headers.Add("Connection", "keep-alive");

        var query = new StreamApplicationLogsQuery
        {
            Since = since,
            Level = level,
            Source = source
        };

        await foreach (var log in _mediator.StreamAsync(query, cancellationToken))
        {
            var json = JsonSerializer.Serialize(log);
            await Response.WriteAsync($"data: {json}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }
}
```

## Pipeline Behaviors for Streaming Queries

### Custom Logging Behavior

```csharp
public class LoggingStreamBehavior<TQuery, TResult> 
    : IStreamQueryPipelineBehavior<TQuery, TResult>
    where TQuery : IStreamQuery<TResult>
{
    private readonly ILogger<LoggingStreamBehavior<TQuery, TResult>> _logger;

    public LoggingStreamBehavior(ILogger<LoggingStreamBehavior<TQuery, TResult>> logger)
    {
        _logger = logger;
    }

    public async IAsyncEnumerable<TResult> Handle(
        TQuery query,
        StreamQueryHandlerDelegate<TResult> next,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting stream query {QueryType}", typeof(TQuery).Name);
        
        var count = 0;
        var startTime = DateTime.UtcNow;

        await foreach (var item in next().WithCancellation(cancellationToken))
        {
            count++;
            yield return item;
        }

        var duration = DateTime.UtcNow - startTime;
        _logger.LogInformation(
            "Completed stream query {QueryType}. Items: {Count}, Duration: {Duration}ms",
            typeof(TQuery).Name,
            count,
            duration.TotalMilliseconds);
    }
}

// Register
builder.Services.AddCortexMediator(
    new[] { typeof(Program).Assembly },
    options => options.AddOpenStreamQueryPipelineBehavior(typeof(LoggingStreamBehavior<,>))
);
```

### Metrics Behavior

```csharp
public class MetricsStreamBehavior<TQuery, TResult> 
    : IStreamQueryPipelineBehavior<TQuery, TResult>
    where TQuery : IStreamQuery<TResult>
{
    private readonly IMetricsCollector _metrics;

    public MetricsStreamBehavior(IMetricsCollector metrics)
    {
        _metrics = metrics;
    }

    public async IAsyncEnumerable<TResult> Handle(
        TQuery query,
        StreamQueryHandlerDelegate<TResult> next,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var count = 0;

        await foreach (var item in next().WithCancellation(cancellationToken))
        {
            count++;
            yield return item;
        }

        stopwatch.Stop();

        _metrics.RecordStreamQuery(
            typeof(TQuery).Name,
            count,
            stopwatch.ElapsedMilliseconds);
    }
}
```

## Best Practices

### DO

- **Use for large datasets** - Perfect for millions of records
- **Stream from database** - Use `AsAsyncEnumerable()`
- **Include [EnumeratorCancellation]** - Support cancellation
- **Log progress** - Track processing for long operations
- **Use batching** - Fetch data in chunks
- **Consider memory** - Stream is only useful if you don't collect all results
- **Use AsNoTracking** - Better performance for read-only queries

### DON'T

- **Don't call ToList() on stream** - Defeats the purpose
- **Don't use for small datasets** - Regular queries are simpler
- **Don't ignore cancellation** - Always respect the token
- **Don't throw in middle of stream** - Handle errors gracefully
- **Don't do complex operations per item** - Keep processing light

## When to Use Streaming Queries

### Use Streaming When:
- Processing millions of records
- Exporting data to files (CSV, JSON, XML)
- Migrating data between systems
- Real-time data feeds
- Memory is constrained
- You need immediate first results

### Use Regular Queries When:
- Dataset fits in memory (< 10,000 records)
- You need to manipulate the entire collection
- You're returning data to an API client
- Simplicity is more important than memory

## Performance Tips

1. **Use batching for database queries**
2. **Apply `AsNoTracking()` for read-only queries**
3. **Use proper indexes on filtered columns**
4. **Limit projections - only select needed fields**
5. **Consider using raw SQL for complex queries**
6. **Monitor memory usage during development**
