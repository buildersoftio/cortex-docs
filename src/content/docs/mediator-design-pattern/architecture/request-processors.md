---
title: Request Processors
description: Request Processors of Cortex Mediator
---

# Request Processors

Request processors provide a simpler alternative to pipeline behaviors for adding pre-processing and post-processing logic to your handlers. They're ideal for cross-cutting concerns that don't need to modify the request/response flow.

## Overview

```mermaid
graph LR
    A[Request] --> B[Pre-Processors]
    B --> C[Handler]
    C --> D[Post-Processors]
    D --> E[Response]
```

## Pre-Processors vs Post-Processors

| Aspect | Pre-Processor | Post-Processor |
|--------|---------------|----------------|
| **When** | Before handler executes | After handler executes |
| **Access** | Request only | Request + Response |
| **Use Cases** | Validation, Authorization, Data enrichment | Logging, Auditing, Notifications |
| **Can Stop** | Yes (throw exception) | No |

## Setup

```csharp
builder.Services.AddCortexMediator(
    new[] { typeof(Program).Assembly },
    options => options.AddProcessorBehaviors()
);
```

## Creating Pre-Processors

### IRequestPreProcessor Interface

```csharp
public interface IRequestPreProcessor<in TRequest>
{
    Task ProcessAsync(TRequest request, CancellationToken cancellationToken);
}
```

### Basic Pre-Processor

```csharp
using Cortex.Mediator.Processors;

public class LoggingPreProcessor<TRequest> : IRequestPreProcessor<TRequest>
{
    private readonly ILogger<LoggingPreProcessor<TRequest>> _logger;

    public LoggingPreProcessor(ILogger<LoggingPreProcessor<TRequest>> logger)
    {
        _logger = logger;
    }

    public Task ProcessAsync(TRequest request, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Processing {RequestType}: {@Request}",
            typeof(TRequest).Name,
            request);

        return Task.CompletedTask;
    }
}

// Register for all requests
builder.Services.AddTransient(typeof(IRequestPreProcessor<>), typeof(LoggingPreProcessor<>));
```

### Request-Specific Pre-Processor

```csharp
public class OrderValidationPreProcessor : IRequestPreProcessor<CreateOrderCommand>
{
    private readonly IInventoryService _inventoryService;

    public OrderValidationPreProcessor(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    public async Task ProcessAsync(
        CreateOrderCommand request,
        CancellationToken cancellationToken)
    {
        // Validate inventory before handler executes
        foreach (var item in request.Items)
        {
            var available = await _inventoryService.CheckAvailabilityAsync(
                item.ProductId,
                item.Quantity,
                cancellationToken);

            if (!available)
            {
                throw new InsufficientInventoryException(item.ProductId);
            }
        }
    }
}

// Register for specific request type
builder.Services.AddTransient<IRequestPreProcessor<CreateOrderCommand>, OrderValidationPreProcessor>();
```

## Creating Post-Processors

### IRequestPostProcessor Interface

```csharp
// For requests that return a value
public interface IRequestPostProcessor<in TRequest, in TResponse>
{
    Task ProcessAsync(TRequest request, TResponse response, CancellationToken cancellationToken);
}

// For void requests
public interface IRequestPostProcessor<in TRequest>
{
    Task ProcessAsync(TRequest request, CancellationToken cancellationToken);
}
```

### Basic Post-Processor with Response

```csharp
public class AuditPostProcessor<TRequest, TResponse> 
    : IRequestPostProcessor<TRequest, TResponse>
{
    private readonly IAuditService _auditService;
    private readonly ICurrentUserService _currentUserService;

    public AuditPostProcessor(
        IAuditService auditService,
        ICurrentUserService currentUserService)
    {
        _auditService = auditService;
        _currentUserService = currentUserService;
    }

    public async Task ProcessAsync(
        TRequest request,
        TResponse response,
        CancellationToken cancellationToken)
    {
        var user = _currentUserService.GetCurrentUser();

        await _auditService.LogAsync(new AuditEntry
        {
            UserId = user?.Id,
            RequestType = typeof(TRequest).Name,
            ResponseType = typeof(TResponse).Name,
            Timestamp = DateTime.UtcNow,
            Success = true
        }, cancellationToken);
    }
}

// Register for all requests
builder.Services.AddTransient(
    typeof(IRequestPostProcessor<,>), 
    typeof(AuditPostProcessor<,>));
```

### Request-Specific Post-Processor

```csharp
public class OrderCreatedPostProcessor : IRequestPostProcessor<CreateOrderCommand, OrderDto>
{
    private readonly IMediator _mediator;
    private readonly ILogger<OrderCreatedPostProcessor> _logger;

    public OrderCreatedPostProcessor(
        IMediator mediator,
        ILogger<OrderCreatedPostProcessor> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    public async Task ProcessAsync(
        CreateOrderCommand request,
        OrderDto response,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Order {OrderId} created, publishing notification",
            response.Id);

        // Publish notification after successful order creation
        await _mediator.PublishAsync(new OrderCreatedNotification
        {
            OrderId = response.Id,
            CustomerId = request.CustomerId,
            TotalAmount = response.TotalAmount
        }, cancellationToken);
    }
}

// Register for specific request/response types
builder.Services.AddTransient<
    IRequestPostProcessor<CreateOrderCommand, OrderDto>,
    OrderCreatedPostProcessor>();
```

### Void Command Post-Processor

```csharp
public class DeleteUserPostProcessor : IRequestPostProcessor<DeleteUserCommand>
{
    private readonly ICacheInvalidator _cacheInvalidator;
    private readonly ISearchIndexService _searchIndex;

    public DeleteUserPostProcessor(
        ICacheInvalidator cacheInvalidator,
        ISearchIndexService searchIndex)
    {
        _cacheInvalidator = cacheInvalidator;
        _searchIndex = searchIndex;
    }

    public async Task ProcessAsync(
        DeleteUserCommand request,
        CancellationToken cancellationToken)
    {
        // Clean up after user deletion
        _cacheInvalidator.InvalidateByPrefix($"user-{request.UserId}");
        
        await _searchIndex.RemoveDocumentAsync(
            "users",
            request.UserId.ToString(),
            cancellationToken);
    }
}
```

## Real-World Examples

### Example 1: Authorization Pre-Processor

```csharp
public interface IRequiresAuthorization
{
    string RequiredPermission { get; }
    Guid? ResourceId { get; }
}

public class AuthorizationPreProcessor<TRequest> : IRequestPreProcessor<TRequest>
    where TRequest : IRequiresAuthorization
{
    private readonly IAuthorizationService _authorizationService;
    private readonly ICurrentUserService _currentUserService;

    public AuthorizationPreProcessor(
        IAuthorizationService authorizationService,
        ICurrentUserService currentUserService)
    {
        _authorizationService = authorizationService;
        _currentUserService = currentUserService;
    }

    public async Task ProcessAsync(
        TRequest request,
        CancellationToken cancellationToken)
    {
        var user = _currentUserService.GetCurrentUser();
        
        if (user == null)
        {
            throw new UnauthorizedException("User is not authenticated");
        }

        var authorized = await _authorizationService.AuthorizeAsync(
            user.Id,
            request.RequiredPermission,
            request.ResourceId,
            cancellationToken);

        if (!authorized)
        {
            throw new ForbiddenException(
                $"User does not have permission: {request.RequiredPermission}");
        }
    }
}

// Usage
public class UpdateOrderCommand : ICommand<OrderDto>, IRequiresAuthorization
{
    public Guid OrderId { get; init; }
    public string Status { get; init; }
    
    public string RequiredPermission => "orders.update";
    public Guid? ResourceId => OrderId;
}
```

### Example 2: Data Enrichment Pre-Processor

```csharp
public interface IHasUserContext
{
    Guid? UserId { get; set; }
    string UserEmail { get; set; }
    string UserName { get; set; }
}

public class UserContextEnrichmentPreProcessor<TRequest> : IRequestPreProcessor<TRequest>
    where TRequest : IHasUserContext
{
    private readonly ICurrentUserService _currentUserService;

    public UserContextEnrichmentPreProcessor(ICurrentUserService currentUserService)
    {
        _currentUserService = currentUserService;
    }

    public Task ProcessAsync(
        TRequest request,
        CancellationToken cancellationToken)
    {
        var user = _currentUserService.GetCurrentUser();
        
        if (user != null)
        {
            request.UserId = user.Id;
            request.UserEmail = user.Email;
            request.UserName = user.Name;
        }

        return Task.CompletedTask;
    }
}

// Usage
public class CreateCommentCommand : ICommand<CommentDto>, IHasUserContext
{
    public string Content { get; init; }
    public Guid PostId { get; init; }
    
    // Auto-filled by pre-processor
    public Guid? UserId { get; set; }
    public string UserEmail { get; set; }
    public string UserName { get; set; }
}
```

### Example 3: Performance Tracking Post-Processor

```csharp
public class PerformanceTrackingPostProcessor<TRequest, TResponse> 
    : IRequestPostProcessor<TRequest, TResponse>
{
    private readonly IMetricsCollector _metrics;
    private readonly ILogger<PerformanceTrackingPostProcessor<TRequest, TResponse>> _logger;

    public PerformanceTrackingPostProcessor(
        IMetricsCollector metrics,
        ILogger<PerformanceTrackingPostProcessor<TRequest, TResponse>> logger)
    {
        _metrics = metrics;
        _logger = logger;
    }

    public Task ProcessAsync(
        TRequest request,
        TResponse response,
        CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;

        // Record success metric
        _metrics.IncrementCounter("mediator_requests_total", new[]
        {
            ("request_type", requestName),
            ("status", "success")
        });

        // Log response size for analysis
        var responseJson = JsonSerializer.Serialize(response);
        if (responseJson.Length > 10000) // 10KB
        {
            _logger.LogWarning(
                "Large response detected for {RequestType}: {Size} bytes",
                requestName,
                responseJson.Length);
        }

        return Task.CompletedTask;
    }
}
```

### Example 4: Cache Invalidation Post-Processor

```csharp
public interface IInvalidatesCache
{
    IEnumerable<string> GetCacheKeysToInvalidate();
}

public class CacheInvalidationPostProcessor<TRequest, TResponse> 
    : IRequestPostProcessor<TRequest, TResponse>
    where TRequest : IInvalidatesCache
{
    private readonly ICacheInvalidator _cacheInvalidator;
    private readonly ILogger<CacheInvalidationPostProcessor<TRequest, TResponse>> _logger;

    public CacheInvalidationPostProcessor(
        ICacheInvalidator cacheInvalidator,
        ILogger<CacheInvalidationPostProcessor<TRequest, TResponse>> logger)
    {
        _cacheInvalidator = cacheInvalidator;
        _logger = logger;
    }

    public Task ProcessAsync(
        TRequest request,
        TResponse response,
        CancellationToken cancellationToken)
    {
        var keysToInvalidate = request.GetCacheKeysToInvalidate().ToList();

        foreach (var key in keysToInvalidate)
        {
            _cacheInvalidator.InvalidateByPrefix(key);
        }

        _logger.LogInformation(
            "Invalidated {Count} cache keys for {RequestType}",
            keysToInvalidate.Count,
            typeof(TRequest).Name);

        return Task.CompletedTask;
    }
}

// Usage
public class UpdateProductCommand : ICommand<ProductDto>, IInvalidatesCache
{
    public Guid ProductId { get; init; }
    public string Name { get; init; }
    public decimal Price { get; init; }

    public IEnumerable<string> GetCacheKeysToInvalidate()
    {
        yield return $"product-{ProductId}";
        yield return "products-list";
        yield return "products-search";
    }
}
```

### Example 5: Notification Post-Processor

```csharp
public interface IPublishesNotification<TNotification> where TNotification : INotification
{
    TNotification CreateNotification();
}

public class NotificationPostProcessor<TRequest, TResponse, TNotification> 
    : IRequestPostProcessor<TRequest, TResponse>
    where TRequest : IPublishesNotification<TNotification>
    where TNotification : INotification
{
    private readonly IMediator _mediator;

    public NotificationPostProcessor(IMediator mediator)
    {
        _mediator = mediator;
    }

    public async Task ProcessAsync(
        TRequest request,
        TResponse response,
        CancellationToken cancellationToken)
    {
        var notification = request.CreateNotification();
        await _mediator.PublishAsync(notification, cancellationToken);
    }
}

// Usage
public class RegisterUserCommand 
    : ICommand<UserDto>, IPublishesNotification<UserRegisteredNotification>
{
    public string Email { get; init; }
    public string Name { get; init; }

    // Will be set after handler executes
    public Guid CreatedUserId { get; set; }

    public UserRegisteredNotification CreateNotification()
    {
        return new UserRegisteredNotification
        {
            UserId = CreatedUserId,
            Email = Email,
            Name = Name
        };
    }
}
```

## Query Processors

For queries, use the dedicated query processor interfaces:

```csharp
// Pre-processor for queries
public class QueryLoggingPreProcessor<TQuery, TResult> 
    : IRequestPreProcessor<TQuery>
    where TQuery : IQuery<TResult>
{
    private readonly ILogger<QueryLoggingPreProcessor<TQuery, TResult>> _logger;

    public QueryLoggingPreProcessor(
        ILogger<QueryLoggingPreProcessor<TQuery, TResult>> logger)
    {
        _logger = logger;
    }

    public Task ProcessAsync(TQuery request, CancellationToken cancellationToken)
    {
        _logger.LogDebug("Executing query {QueryType}", typeof(TQuery).Name);
        return Task.CompletedTask;
    }
}

// Post-processor for queries
public class QueryMetricsPostProcessor<TQuery, TResult> 
    : IRequestPostProcessor<TQuery, TResult>
    where TQuery : IQuery<TResult>
{
    private readonly IMetricsCollector _metrics;

    public QueryMetricsPostProcessor(IMetricsCollector metrics)
    {
        _metrics = metrics;
    }

    public Task ProcessAsync(
        TQuery request,
        TResult response,
        CancellationToken cancellationToken)
    {
        _metrics.IncrementCounter("queries_executed", new[]
        {
            ("query_type", typeof(TQuery).Name)
        });

        return Task.CompletedTask;
    }
}
```

## Registration Patterns

### Register for All Requests

```csharp
// Generic pre-processor for all requests
builder.Services.AddTransient(
    typeof(IRequestPreProcessor<>), 
    typeof(LoggingPreProcessor<>));

// Generic post-processor for all request/response combinations
builder.Services.AddTransient(
    typeof(IRequestPostProcessor<,>), 
    typeof(AuditPostProcessor<,>));
```

### Register for Specific Requests

```csharp
// Pre-processor for specific command
builder.Services.AddTransient<
    IRequestPreProcessor<CreateOrderCommand>,
    OrderValidationPreProcessor>();

// Post-processor for specific command and response
builder.Services.AddTransient<
    IRequestPostProcessor<CreateOrderCommand, OrderDto>,
    OrderCreatedPostProcessor>();
```

### Conditional Registration

```csharp
// Register only for requests implementing an interface
builder.Services.Scan(scan => scan
    .FromAssemblyOf<Program>()
    .AddClasses(classes => classes
        .AssignableTo(typeof(IRequestPreProcessor<>)))
    .AsImplementedInterfaces()
    .WithTransientLifetime());
```

## Processors vs Behaviors

| Aspect | Processors | Behaviors |
|--------|------------|-----------|
| **Complexity** | Simple | More complex |
| **Modification** | Can't modify request/response | Can modify both |
| **Short-circuit** | Pre can throw | Full control over flow |
| **Wrap Handler** | No | Yes |
| **Best For** | Side effects | Cross-cutting logic |

Use **Processors** when you need to:
- Log requests/responses
- Validate before execution
- Audit after execution
- Publish notifications
- Invalidate cache

Use **Behaviors** when you need to:
- Transform requests/responses
- Short-circuit based on conditions
- Implement caching
- Add retry logic
- Measure execution time

## Best Practices

### ? DO

- **Keep processors focused** - One processor, one responsibility
- **Use interfaces** - Define marker interfaces for conditional processing
- **Handle failures gracefully** - Don't let post-processor failures break the response
- **Log appropriately** - Use proper log levels
- **Register in correct order** - Pre-processors run in registration order

### ? DON'T

- **Don't modify requests in post-processors** - They run after the handler
- **Don't use for business logic** - Keep that in handlers
- **Don't make post-processors critical** - They shouldn't affect the main response
- **Don't forget async** - Always use async/await
- **Don't swallow exceptions** - Log and rethrow if needed
