---
title: CQRS and Cortex Mediator
description: Mediator Design Pattern with Cortex.Mediator
---


**CQRS (Command Query Responsibility Segregation)** is an architectural pattern splitting read and write operations:

- **Commands**: Change system state; do not return data.
- **Queries**: Return data without changing state.

**Cortex.Mediator** naturally supports CQRS:

- Implement commands (`ICommand<TResult>`) + handlers for writes.
- Implement queries (`IQuery<TResult>`) + handlers for reads.
- Keep them in separate classes/modules for clarity.

Notifications further extend event-driven designs by letting different parts of the system react asynchronously.

## Example End-to-End Usage
Below is a simplified example combining commands, queries, and notifications with pipeline behaviors:

```csharp
using Cortex.Mediator;

// 1. Register services in your Startup
public void ConfigureServices(IServiceCollection services)
{
    services.AddControllers();
    // Suppose you have an IDbConnection or EF DbContext to manage
    // services.AddScoped<IDbConnection>(...);

    // 2. Add Cortex.Mediator, scanning your assembly
    services.AddCortexMediator(Configuration, new[] { typeof(Startup) }, options =>
    {
        // Add default pipeline behaviors (Validation, Logging, Transaction)
        options.AddDefaultBehaviors();
    });

    // 3. Register your other dependencies
}

// 2. Example command and handler
public class CreateInvoiceCommand : ICommand<Unit>
{
    public string CustomerId { get; set; }
    public decimal Amount { get; set; }
}

public class CreateInvoiceCommandHandler : ICommandHandler<CreateInvoiceCommand, Unit>
{
    public async Task<Unit> Handle(CreateInvoiceCommand command, CancellationToken cancellationToken)
    {
        // Insert into DB, e.g.
        // _dbContext.Invoices.Add(new Invoice { ... });
        // await _dbContext.SaveChangesAsync();

        Console.WriteLine($"Invoice created for Customer: {command.CustomerId} Amount: {command.Amount}");

        return Unit.Value;
    }
}

// 3. Example query and handler
public class GetInvoiceQuery : IQuery<InvoiceDto>
{
    public int InvoiceId { get; set; }
}

public class GetInvoiceQueryHandler : IQueryHandler<GetInvoiceQuery, InvoiceDto>
{
    public async Task<InvoiceDto> Handle(GetInvoiceQuery query, CancellationToken cancellationToken)
    {
        // e.g. retrieve from DB
        return new InvoiceDto
        {
            InvoiceId = query.InvoiceId,
            CustomerId = "cust123",
            Amount = 199.99m
        };
    }
}

public class InvoiceDto
{
    public int InvoiceId { get; set; }
    public string CustomerId { get; set; }
    public decimal Amount { get; set; }
}

// 4. Example usage in a controller
[ApiController]
[Route("api/[controller]")]
public class InvoicesController : ControllerBase
{
    private readonly IMediator _mediator;

    public InvoicesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateInvoice([FromBody] CreateInvoiceCommand command)
    {
        await _mediator.SendCommandAsync<CreateInvoiceCommand, Unit>(command);  // triggers CreateInvoiceCommandHandler
        return Ok("Invoice created.");
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<InvoiceDto>> GetInvoice(int id)
    {
        var dto = await _mediator.SendQueryAsync<GetInvoiceQuery, InvoiceDto>(new GetInvoiceQuery { InvoiceId = id });
        return Ok(dto);
    }
}

```

## Conclusion

**Cortex.Mediator** elegantly integrates with .NET’s DI container and fosters a clean CQRS approach:

- **Commands** and **Queries** keep your read/write operations separate and explicit.

- **Notifications** enable event-based architectures.

- **Pipeline Behaviors** give you flexible ways to add cross-cutting concerns like logging, transactions, and validation.

For smaller projects, the separation may be minimal — but as your application grows, Cortex.Mediator’s structured approach will help keep the code organized, testable, and scalable.