---
title: Queries
description: Queries with Cortex.Mediator
---

# Queries

Queries represent **read operations** in your application - requests to retrieve data without modifying state. They follow the Query pattern from CQRS (Command Query Responsibility Segregation).

## What is a Query?

A query is a request to retrieve data from your system, such as:
- Getting a single entity by ID
- Searching for records
- Generating reports
- Calculating aggregates
- Retrieving paginated lists

Queries **always return data** and **never modify state**.

## Creating Queries

### Simple Query

```csharp
using Cortex.Mediator.Queries;

public class GetUserByIdQuery : IQuery<UserDto>
{
    public Guid UserId { get; set; }
}

public class UserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public DateTime CreatedAt { get; set; }
}
```

### Query with Multiple Parameters

```csharp
public class SearchProductsQuery : IQuery<PagedResult<ProductDto>>
{
    public string SearchTerm { get; set; }
    public string Category { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class PagedResult<T>
{
    public List<T> Items { get; set; }
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
}
```

### Query Returning Collection

```csharp
public class GetUserOrdersQuery : IQuery<List<OrderDto>>
{
    public Guid UserId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}
```

## Implementing Query Handlers

### Simple Query Handler

```csharp
using Cortex.Mediator.Queries;

public class GetUserByIdQueryHandler : IQueryHandler<GetUserByIdQuery, UserDto>
{
    private readonly IUserRepository _userRepository;
    private readonly ILogger<GetUserByIdQueryHandler> _logger;

    public GetUserByIdQueryHandler(
        IUserRepository userRepository,
        ILogger<GetUserByIdQueryHandler> logger)
    {
        _userRepository = userRepository;
        _logger = logger;
    }

    public async Task<UserDto> Handle(
        GetUserByIdQuery query, 
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Fetching user {UserId}", query.UserId);

        var user = await _userRepository.GetByIdAsync(query.UserId, cancellationToken);
        
        if (user == null)
        {
            throw new NotFoundException($"User {query.UserId} not found");
        }

        return new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            FirstName = user.FirstName,
            LastName = user.LastName,
            CreatedAt = user.CreatedAt
        };
    }
}
```

### Complex Query Handler with Filtering

```csharp
public class SearchProductsQueryHandler : IQueryHandler<SearchProductsQuery, PagedResult<ProductDto>>
{
    private readonly IProductRepository _productRepository;

    public SearchProductsQueryHandler(IProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    public async Task<PagedResult<ProductDto>> Handle(
        SearchProductsQuery query,
        CancellationToken cancellationToken)
    {
        // Build query with filters
        var productsQuery = _productRepository.Query();

        if (!string.IsNullOrEmpty(query.SearchTerm))
        {
            productsQuery = productsQuery.Where(p => 
                p.Name.Contains(query.SearchTerm) || 
                p.Description.Contains(query.SearchTerm));
        }

        if (!string.IsNullOrEmpty(query.Category))
        {
            productsQuery = productsQuery.Where(p => p.Category == query.Category);
        }

        if (query.MinPrice.HasValue)
        {
            productsQuery = productsQuery.Where(p => p.Price >= query.MinPrice.Value);
        }

        if (query.MaxPrice.HasValue)
        {
            productsQuery = productsQuery.Where(p => p.Price <= query.MaxPrice.Value);
        }

        // Get total count
        var totalCount = await productsQuery.CountAsync(cancellationToken);

        // Apply pagination
        var products = await productsQuery
            .OrderBy(p => p.Name)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        // Map to DTOs
        var productDtos = products.Select(p => new ProductDto
        {
            Id = p.Id,
            Name = p.Name,
            Description = p.Description,
            Price = p.Price,
            Category = p.Category
        }).ToList();

        return new PagedResult<ProductDto>
        {
            Items = productDtos,
            TotalCount = totalCount,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }
}
```

## Sending Queries

### Simplified API (Recommended)

```csharp
public class UsersController : ControllerBase
{
    private readonly IMediator _mediator;

    public UsersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetUser(Guid id)
    {
        // Simple syntax - type is inferred
        var user = await _mediator.QueryAsync(new GetUserByIdQuery { UserId = id });
        return Ok(user);
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchProducts(
        [FromQuery] string searchTerm,
        [FromQuery] string category,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = new SearchProductsQuery
        {
            SearchTerm = searchTerm,
            Category = category,
            MinPrice = minPrice,
            MaxPrice = maxPrice,
            Page = page,
            PageSize = pageSize
        };

        var result = await _mediator.QueryAsync(query);
        return Ok(result);
    }
}
```

### Explicit Type Parameters (Legacy)

```csharp
var user = await _mediator.SendQueryAsync<GetUserByIdQuery, UserDto>(query);
```

## Real-World Examples

### Example 1: Dashboard Statistics

```csharp
// Query
public class GetDashboardStatsQuery : IQuery<DashboardStatsDto>
{
    public Guid UserId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}

// Result DTO
public class DashboardStatsDto
{
    public int TotalOrders { get; set; }
    public decimal TotalRevenue { get; set; }
    public int NewCustomers { get; set; }
    public List<CategorySales> SalesByCategory { get; set; }
    public List<DailySales> DailySales { get; set; }
}

public class CategorySales
{
    public string Category { get; set; }
    public decimal TotalSales { get; set; }
    public int OrderCount { get; set; }
}

public class DailySales
{
    public DateTime Date { get; set; }
    public decimal Amount { get; set; }
}

// Handler
public class GetDashboardStatsQueryHandler : IQueryHandler<GetDashboardStatsQuery, DashboardStatsDto>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ICustomerRepository _customerRepository;

    public GetDashboardStatsQueryHandler(
        IOrderRepository orderRepository,
        ICustomerRepository customerRepository)
    {
        _orderRepository = orderRepository;
        _customerRepository = customerRepository;
    }

    public async Task<DashboardStatsDto> Handle(
        GetDashboardStatsQuery query,
        CancellationToken cancellationToken)
    {
        var fromDate = query.FromDate ?? DateTime.UtcNow.AddDays(-30);
        var toDate = query.ToDate ?? DateTime.UtcNow;

        // Get orders in date range
        var orders = await _orderRepository
            .GetOrdersByDateRangeAsync(fromDate, toDate, cancellationToken);

        // Calculate statistics
        var stats = new DashboardStatsDto
        {
            TotalOrders = orders.Count,
            TotalRevenue = orders.Sum(o => o.TotalAmount),
            NewCustomers = await _customerRepository
                .CountNewCustomersAsync(fromDate, toDate, cancellationToken),
            
            SalesByCategory = orders
                .SelectMany(o => o.Items)
                .GroupBy(i => i.Category)
                .Select(g => new CategorySales
                {
                    Category = g.Key,
                    TotalSales = g.Sum(i => i.Price * i.Quantity),
                    OrderCount = g.Count()
                })
                .ToList(),
            
            DailySales = orders
                .GroupBy(o => o.OrderDate.Date)
                .Select(g => new DailySales
                {
                    Date = g.Key,
                    Amount = g.Sum(o => o.TotalAmount)
                })
                .OrderBy(d => d.Date)
                .ToList()
        };

        return stats;
    }
}

// Usage in controller
[HttpGet("dashboard")]
public async Task<IActionResult> GetDashboard(
    [FromQuery] DateTime? fromDate,
    [FromQuery] DateTime? toDate)
{
    var query = new GetDashboardStatsQuery
    {
        UserId = GetCurrentUserId(),
        FromDate = fromDate,
        ToDate = toDate
    };

    var stats = await _mediator.QueryAsync(query);
    return Ok(stats);
}
```

### Example 2: Complex Search with Specifications

```csharp
// Query
public class SearchUsersQuery : IQuery<PagedResult<UserSummaryDto>>
{
    public string Email { get; set; }
    public string Name { get; set; }
    public bool? IsActive { get; set; }
    public DateTime? RegisteredAfter { get; set; }
    public DateTime? RegisteredBefore { get; set; }
    public string Role { get; set; }
    public string SortBy { get; set; } = "Email";
    public bool SortDescending { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

// Result DTO
public class UserSummaryDto
{
    public Guid Id { get; set; }
    public string Email { get; set; }
    public string FullName { get; set; }
    public bool IsActive { get; set; }
    public DateTime RegisteredAt { get; set; }
    public string Role { get; set; }
    public int OrderCount { get; set; }
}

// Handler
public class SearchUsersQueryHandler : IQueryHandler<SearchUsersQuery, PagedResult<UserSummaryDto>>
{
    private readonly ApplicationDbContext _context;

    public SearchUsersQueryHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<UserSummaryDto>> Handle(
        SearchUsersQuery query,
        CancellationToken cancellationToken)
    {
        var usersQuery = _context.Users.AsQueryable();

        // Apply filters
        if (!string.IsNullOrEmpty(query.Email))
        {
            usersQuery = usersQuery.Where(u => u.Email.Contains(query.Email));
        }

        if (!string.IsNullOrEmpty(query.Name))
        {
            usersQuery = usersQuery.Where(u => 
                (u.FirstName + " " + u.LastName).Contains(query.Name));
        }

        if (query.IsActive.HasValue)
        {
            usersQuery = usersQuery.Where(u => u.IsActive == query.IsActive.Value);
        }

        if (query.RegisteredAfter.HasValue)
        {
            usersQuery = usersQuery.Where(u => u.CreatedAt >= query.RegisteredAfter.Value);
        }

        if (query.RegisteredBefore.HasValue)
        {
            usersQuery = usersQuery.Where(u => u.CreatedAt <= query.RegisteredBefore.Value);
        }

        if (!string.IsNullOrEmpty(query.Role))
        {
            usersQuery = usersQuery.Where(u => u.Role == query.Role);
        }

        // Apply sorting
        usersQuery = query.SortBy?.ToLower() switch
        {
            "email" => query.SortDescending 
                ? usersQuery.OrderByDescending(u => u.Email)
                : usersQuery.OrderBy(u => u.Email),
            "name" => query.SortDescending
                ? usersQuery.OrderByDescending(u => u.FirstName).ThenByDescending(u => u.LastName)
                : usersQuery.OrderBy(u => u.FirstName).ThenBy(u => u.LastName),
            "date" => query.SortDescending
                ? usersQuery.OrderByDescending(u => u.CreatedAt)
                : usersQuery.OrderBy(u => u.CreatedAt),
            _ => usersQuery.OrderBy(u => u.Email)
        };

        // Get total count
        var totalCount = await usersQuery.CountAsync(cancellationToken);

        // Apply pagination and include order count
        var users = await usersQuery
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                Email = u.Email,
                FullName = $"{u.FirstName} {u.LastName}",
                IsActive = u.IsActive,
                RegisteredAt = u.CreatedAt,
                Role = u.Role,
                OrderCount = u.Orders.Count()
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<UserSummaryDto>
        {
            Items = users,
            TotalCount = totalCount,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }
}
```

### Example 3: Report Generation

```csharp
// Query
public class GenerateSalesReportQuery : IQuery<SalesReportDto>
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string GroupBy { get; set; } // "day", "week", "month"
    public List<string> Categories { get; set; }
}

// Result DTO
public class SalesReportDto
{
    public DateTime GeneratedAt { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal TotalRevenue { get; set; }
    public int TotalOrders { get; set; }
    public decimal AverageOrderValue { get; set; }
    public List<SalesDataPoint> DataPoints { get; set; }
    public List<TopProduct> TopProducts { get; set; }
}

public class SalesDataPoint
{
    public DateTime Period { get; set; }
    public decimal Revenue { get; set; }
    public int OrderCount { get; set; }
}

public class TopProduct
{
    public string ProductName { get; set; }
    public int UnitsSold { get; set; }
    public decimal TotalRevenue { get; set; }
}

// Handler
public class GenerateSalesReportQueryHandler 
    : IQueryHandler<GenerateSalesReportQuery, SalesReportDto>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<GenerateSalesReportQueryHandler> _logger;

    public GenerateSalesReportQueryHandler(
        IOrderRepository orderRepository,
        ILogger<GenerateSalesReportQueryHandler> logger)
    {
        _orderRepository = orderRepository;
        _logger = logger;
    }

    public async Task<SalesReportDto> Handle(
        GenerateSalesReportQuery query,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Generating sales report from {StartDate} to {EndDate}",
            query.StartDate,
            query.EndDate);

        var orders = await _orderRepository.GetOrdersInPeriodAsync(
            query.StartDate,
            query.EndDate,
            cancellationToken);

        // Filter by categories if specified
        if (query.Categories?.Any() == true)
        {
            orders = orders.Where(o => 
                o.Items.Any(i => query.Categories.Contains(i.Category)))
                .ToList();
        }

        // Calculate aggregates
        var totalRevenue = orders.Sum(o => o.TotalAmount);
        var totalOrders = orders.Count;

        // Group data points
        var dataPoints = GroupDataPoints(orders, query.GroupBy);

        // Get top products
        var topProducts = orders
            .SelectMany(o => o.Items)
            .GroupBy(i => i.ProductName)
            .Select(g => new TopProduct
            {
                ProductName = g.Key,
                UnitsSold = g.Sum(i => i.Quantity),
                TotalRevenue = g.Sum(i => i.Price * i.Quantity)
            })
            .OrderByDescending(p => p.TotalRevenue)
            .Take(10)
            .ToList();

        return new SalesReportDto
        {
            GeneratedAt = DateTime.UtcNow,
            StartDate = query.StartDate,
            EndDate = query.EndDate,
            TotalRevenue = totalRevenue,
            TotalOrders = totalOrders,
            AverageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0,
            DataPoints = dataPoints,
            TopProducts = topProducts
        };
    }

    private List<SalesDataPoint> GroupDataPoints(List<Order> orders, string groupBy)
    {
        return groupBy?.ToLower() switch
        {
            "day" => orders
                .GroupBy(o => o.OrderDate.Date)
                .Select(g => new SalesDataPoint
                {
                    Period = g.Key,
                    Revenue = g.Sum(o => o.TotalAmount),
                    OrderCount = g.Count()
                })
                .OrderBy(d => d.Period)
                .ToList(),
            
            "week" => orders
                .GroupBy(o => GetStartOfWeek(o.OrderDate))
                .Select(g => new SalesDataPoint
                {
                    Period = g.Key,
                    Revenue = g.Sum(o => o.TotalAmount),
                    OrderCount = g.Count()
                })
                .OrderBy(d => d.Period)
                .ToList(),
            
            "month" => orders
                .GroupBy(o => new DateTime(o.OrderDate.Year, o.OrderDate.Month, 1))
                .Select(g => new SalesDataPoint
                {
                    Period = g.Key,
                    Revenue = g.Sum(o => o.TotalAmount),
                    OrderCount = g.Count()
                })
                .OrderBy(d => d.Period)
                .ToList(),
            
            _ => new List<SalesDataPoint>()
        };
    }

    private DateTime GetStartOfWeek(DateTime date)
    {
        var diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
        return date.AddDays(-1 * diff).Date;
    }
}
```

## Query Optimization Tips

### 1. Use Projections

```csharp
// ? Bad - loads entire entity
var users = await _context.Users
    .Where(u => u.IsActive)
    .ToListAsync();

var dtos = users.Select(u => new UserDto { ... }).ToList();

// ? Good - only select needed fields
var dtos = await _context.Users
    .Where(u => u.IsActive)
    .Select(u => new UserDto
    {
        Id = u.Id,
        Email = u.Email,
        Name = u.FirstName + " " + u.LastName
    })
    .ToListAsync();
```

### 2. Use AsNoTracking for Read-Only Queries

```csharp
// ? Better performance for read-only queries
var users = await _context.Users
    .AsNoTracking()
    .Where(u => u.IsActive)
    .ToListAsync(cancellationToken);
```

### 3. Implement Caching

```csharp
using Cortex.Mediator.Caching;

[Cacheable(AbsoluteExpirationSeconds = 300, SlidingExpirationSeconds = 60)]
public class GetUserByIdQuery : IQuery<UserDto>
{
    public Guid UserId { get; set; }
}
```

## Best Practices

### DO

- **Keep queries focused** - One query should retrieve one type of data
- **Return DTOs** - Never return domain entities directly
- **Use pagination** - For queries returning lists
- **Add filtering and sorting** - Make queries flexible
- **Log slow queries** - Monitor performance
- **Use projections** - Select only needed fields
- **Implement caching** - For frequently accessed data
- **Handle not found** - Throw NotFoundException or return null

### DON'T

- **Don't modify state** - Queries should be read-only
- **Don't use transactions** - Unless reading from multiple sources
- **Don't return IQueryable** - Always materialize results
- **Don't over-fetch data** - Use Select to project
- **Don't ignore pagination** - Large datasets can cause memory issues

## Query Naming Conventions

```csharp
// Good names (verb + what you're getting)
GetUserByIdQuery
SearchProductsQuery
GetOrdersByCustomerQuery
GetDashboardStatsQuery
ListActiveUsersQuery
FindProductsByCategoryQuery

// Bad names (ambiguous or wrong pattern)
UserQuery
GetUsersCommand  // Commands are for writes
ProductsQuery    // Too generic
DataQuery        // Too vague
```

## Testing Queries

```csharp
public class GetUserByIdQueryHandlerTests
{
    [Fact]
    public async Task Handle_ExistingUser_ReturnsUserDto()
    {
        // Arrange
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "test@example.com",
            FirstName = "John",
            LastName = "Doe"
        };

        var mockRepository = new Mock<IUserRepository>();
        mockRepository
            .Setup(x => x.GetByIdAsync(user.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var handler = new GetUserByIdQueryHandler(
            mockRepository.Object,
            Mock.Of<ILogger<GetUserByIdQueryHandler>>());

        var query = new GetUserByIdQuery { UserId = user.Id };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(user.Email, result.Email);
        Assert.Equal(user.FirstName, result.FirstName);
    }

    [Fact]
    public async Task Handle_NonExistentUser_ThrowsNotFoundException()
    {
        // Arrange
        var mockRepository = new Mock<IUserRepository>();
        mockRepository
            .Setup(x => x.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User)null);

        var handler = new GetUserByIdQueryHandler(
            mockRepository.Object,
            Mock.Of<ILogger<GetUserByIdQueryHandler>>());

        var query = new GetUserByIdQuery { UserId = Guid.NewGuid() };

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => 
            handler.Handle(query, CancellationToken.None));
    }
}
```
