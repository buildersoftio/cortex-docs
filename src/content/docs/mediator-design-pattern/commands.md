---
title: Commands
description: Commands with Cortex.Mediator
---


# Commands

Commands represent **write operations** in your application - actions that change state. They follow the Command pattern from CQRS (Command Query Responsibility Segregation).

## What is a Command?

A command is a request to perform an action that changes the system's state, such as:
- Creating a new entity
- Updating existing data
- Deleting records
- Sending emails
- Processing payments

Commands can return a result (like an ID) or return nothing (void).

## Creating Commands

### Command with Return Value

```csharp
using Cortex.Mediator.Commands;

public class CreateOrderCommand : ICommand<Guid>
{
    public string CustomerName { get; set; }
    public string Email { get; set; }
    public List<OrderItem> Items { get; set; }
    public decimal TotalAmount { get; set; }
}

public class OrderItem
{
    public string ProductName { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
}
```

### Void Command (No Return Value)

```csharp
using Cortex.Mediator.Commands;
using Cortex.Mediator.Common;

public class SendWelcomeEmailCommand : ICommand<Unit>
{
    public string Email { get; set; }
    public string UserName { get; set; }
}

// Or use the shorthand:
public class DeleteUserCommand : ICommand
{
    public Guid UserId { get; set; }
}
```

## Implementing Command Handlers

### Handler with Return Value

```csharp
using Cortex.Mediator.Commands;

public class CreateOrderCommandHandler : ICommandHandler<CreateOrderCommand, Guid>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<CreateOrderCommandHandler> _logger;

    public CreateOrderCommandHandler(
        IOrderRepository orderRepository,
        ILogger<CreateOrderCommandHandler> logger)
    {
        _orderRepository = orderRepository;
        _logger = logger;
    }

    public async Task<Guid> Handle(
        CreateOrderCommand command, 
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Creating order for {CustomerName}", command.CustomerName);

        var order = new Order
        {
            Id = Guid.NewGuid(),
            CustomerName = command.CustomerName,
            Email = command.Email,
            Items = command.Items,
            TotalAmount = command.TotalAmount,
            CreatedAt = DateTime.UtcNow
        };

        await _orderRepository.AddAsync(order, cancellationToken);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Order {OrderId} created successfully", order.Id);

        return order.Id;
    }
}
```

### Void Command Handler

```csharp
using Cortex.Mediator.Commands;
using Cortex.Mediator.Common;

public class SendWelcomeEmailCommandHandler : ICommandHandler<SendWelcomeEmailCommand, Unit>
{
    private readonly IEmailService _emailService;

    public SendWelcomeEmailCommandHandler(IEmailService emailService)
    {
        _emailService = emailService;
    }

    public async Task<Unit> Handle(
        SendWelcomeEmailCommand command, 
        CancellationToken cancellationToken)
    {
        await _emailService.SendEmailAsync(
            command.Email,
            "Welcome!",
            $"Hello {command.UserName}, welcome to our platform!",
            cancellationToken
        );

        return Unit.Value; // Unit represents "no value"
    }
}
```

## Sending Commands

### Simplified API (Recommended)

The type is automatically inferred from the command:

```csharp
public class OrdersController : ControllerBase
{
    private readonly IMediator _mediator;

    public OrdersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder(CreateOrderRequest request)
    {
        var command = new CreateOrderCommand
        {
            CustomerName = request.CustomerName,
            Email = request.Email,
            Items = request.Items,
            TotalAmount = request.TotalAmount
        };

        // Simple syntax - type is inferred
        var orderId = await _mediator.SendAsync(command);

        return CreatedAtAction(
            nameof(GetOrder), 
            new { id = orderId }, 
            new { orderId });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteOrder(Guid id)
    {
        // Void command
        await _mediator.SendAsync(new DeleteOrderCommand { OrderId = id });
        return NoContent();
    }
}
```

### Explicit Type Parameters (Legacy)

```csharp
// With return value
var orderId = await _mediator.SendCommandAsync<CreateOrderCommand, Guid>(command);

// Void command
await _mediator.SendCommandAsync<DeleteOrderCommand, Unit>(command);
```

## Real-World Examples

### Example 1: User Registration

```csharp
// Command
public class RegisterUserCommand : ICommand<UserRegistrationResult>
{
    public string Email { get; set; }
    public string Password { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
}

// Result
public class UserRegistrationResult
{
    public Guid UserId { get; set; }
    public string Email { get; set; }
    public bool EmailVerificationRequired { get; set; }
}

// Handler
public class RegisterUserCommandHandler : ICommandHandler<RegisterUserCommand, UserRegistrationResult>
{
    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IMediator _mediator;

    public RegisterUserCommandHandler(
        IUserRepository userRepository,
        IPasswordHasher passwordHasher,
        IMediator mediator)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _mediator = mediator;
    }

    public async Task<UserRegistrationResult> Handle(
        RegisterUserCommand command,
        CancellationToken cancellationToken)
    {
        // Check if user exists
        var existingUser = await _userRepository.FindByEmailAsync(
            command.Email, 
            cancellationToken);
        
        if (existingUser != null)
        {
            throw new ValidationException("Email already registered");
        }

        // Create user
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = command.Email,
            PasswordHash = _passwordHasher.HashPassword(command.Password),
            FirstName = command.FirstName,
            LastName = command.LastName,
            CreatedAt = DateTime.UtcNow,
            EmailVerified = false
        };

        await _userRepository.AddAsync(user, cancellationToken);
        await _userRepository.SaveChangesAsync(cancellationToken);

        // Publish notification
        await _mediator.PublishAsync(new UserRegisteredNotification
        {
            UserId = user.Id,
            Email = user.Email,
            FullName = $"{user.FirstName} {user.LastName}"
        }, cancellationToken);

        return new UserRegistrationResult
        {
            UserId = user.Id,
            Email = user.Email,
            EmailVerificationRequired = true
        };
    }
}
```

### Example 2: Process Payment

```csharp
// Command
public class ProcessPaymentCommand : ICommand<PaymentResult>
{
    public Guid OrderId { get; set; }
    public string PaymentMethod { get; set; }
    public decimal Amount { get; set; }
    public string CardToken { get; set; }
}

// Result
public class PaymentResult
{
    public bool Success { get; set; }
    public string TransactionId { get; set; }
    public string ErrorMessage { get; set; }
}

// Handler
public class ProcessPaymentCommandHandler : ICommandHandler<ProcessPaymentCommand, PaymentResult>
{
    private readonly IPaymentGateway _paymentGateway;
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<ProcessPaymentCommandHandler> _logger;

    public ProcessPaymentCommandHandler(
        IPaymentGateway paymentGateway,
        IOrderRepository orderRepository,
        ILogger<ProcessPaymentCommandHandler> logger)
    {
        _paymentGateway = paymentGateway;
        _orderRepository = orderRepository;
        _logger = logger;
    }

    public async Task<PaymentResult> Handle(
        ProcessPaymentCommand command,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Processing payment for order {OrderId}", command.OrderId);

        try
        {
            // Get order
            var order = await _orderRepository.GetByIdAsync(command.OrderId, cancellationToken);
            if (order == null)
            {
                return new PaymentResult
                {
                    Success = false,
                    ErrorMessage = "Order not found"
                };
            }

            // Process payment
            var paymentResponse = await _paymentGateway.ChargeAsync(
                command.CardToken,
                command.Amount,
                cancellationToken);

            if (paymentResponse.Success)
            {
                // Update order
                order.PaymentStatus = PaymentStatus.Paid;
                order.TransactionId = paymentResponse.TransactionId;
                order.PaidAt = DateTime.UtcNow;

                await _orderRepository.UpdateAsync(order, cancellationToken);
                await _orderRepository.SaveChangesAsync(cancellationToken);

                _logger.LogInformation(
                    "Payment successful for order {OrderId}, transaction {TransactionId}",
                    command.OrderId,
                    paymentResponse.TransactionId);

                return new PaymentResult
                {
                    Success = true,
                    TransactionId = paymentResponse.TransactionId
                };
            }

            _logger.LogWarning(
                "Payment failed for order {OrderId}: {ErrorMessage}",
                command.OrderId,
                paymentResponse.ErrorMessage);

            return new PaymentResult
            {
                Success = false,
                ErrorMessage = paymentResponse.ErrorMessage
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing payment for order {OrderId}", command.OrderId);
            throw;
        }
    }
}

// Usage in controller
[HttpPost("orders/{orderId}/pay")]
public async Task<IActionResult> ProcessPayment(Guid orderId, ProcessPaymentRequest request)
{
    var command = new ProcessPaymentCommand
    {
        OrderId = orderId,
        PaymentMethod = request.PaymentMethod,
        Amount = request.Amount,
        CardToken = request.CardToken
    };

    var result = await _mediator.SendAsync(command);

    if (result.Success)
    {
        return Ok(new { transactionId = result.TransactionId });
    }

    return BadRequest(new { error = result.ErrorMessage });
}
```

### Example 3: Bulk Operations

```csharp
// Command for bulk user import
public class ImportUsersCommand : ICommand<ImportResult>
{
    public List<UserImportDto> Users { get; set; }
}

public class ImportResult
{
    public int TotalProcessed { get; set; }
    public int SuccessCount { get; set; }
    public int FailureCount { get; set; }
    public List<string> Errors { get; set; }
}

// Handler
public class ImportUsersCommandHandler : ICommandHandler<ImportUsersCommand, ImportResult>
{
    private readonly IUserRepository _userRepository;
    private readonly ILogger<ImportUsersCommandHandler> _logger;

    public ImportUsersCommandHandler(
        IUserRepository userRepository,
        ILogger<ImportUsersCommandHandler> logger)
    {
        _userRepository = userRepository;
        _logger = logger;
    }

    public async Task<ImportResult> Handle(
        ImportUsersCommand command,
        CancellationToken cancellationToken)
    {
        var result = new ImportResult { Errors = new List<string>() };
        
        foreach (var userDto in command.Users)
        {
            result.TotalProcessed++;

            try
            {
                var user = new User
                {
                    Id = Guid.NewGuid(),
                    Email = userDto.Email,
                    FirstName = userDto.FirstName,
                    LastName = userDto.LastName
                };

                await _userRepository.AddAsync(user, cancellationToken);
                result.SuccessCount++;
            }
            catch (Exception ex)
            {
                result.FailureCount++;
                result.Errors.Add($"Failed to import {userDto.Email}: {ex.Message}");
                _logger.LogError(ex, "Error importing user {Email}", userDto.Email);
            }
        }

        await _userRepository.SaveChangesAsync(cancellationToken);
        
        _logger.LogInformation(
            "Import completed: {SuccessCount} successful, {FailureCount} failed",
            result.SuccessCount,
            result.FailureCount);

        return result;
    }
}
```

## Best Practices

### DO

- **Keep commands simple** - One command should do one thing
- **Make commands immutable** - Use init-only properties or readonly fields
- **Validate in handlers** - Use FluentValidation or manual validation
- **Return meaningful results** - Provide useful information to callers
- **Use descriptive names** - `CreateOrderCommand`, not `OrderCommand`
- **Log important actions** - Help with debugging and auditing
- **Handle errors gracefully** - Use try-catch or exception behaviors

### DON'T

- **Don't query in commands** - Keep commands focused on writes
- **Don't return domain entities** - Return DTOs or result objects
- **Don't put business logic in commands** - Keep it in handlers
- **Don't make commands depend on other commands** - Keep them independent
- **Don't forget cancellation tokens** - Always respect cancellation

## Command Naming Conventions

```csharp
// Good names (verb + noun)
CreateUserCommand
UpdateOrderCommand
DeleteProductCommand
SendEmailCommand
ProcessPaymentCommand
ApproveRequestCommand

// Bad names (ambiguous)
UserCommand
OrderCommand
DataCommand
ProcessCommand
```

## Testing Commands

```csharp
public class CreateOrderCommandHandlerTests
{
    [Fact]
    public async Task Handle_ValidCommand_CreatesOrder()
    {
        // Arrange
        var mockRepository = new Mock<IOrderRepository>();
        var mockLogger = new Mock<ILogger<CreateOrderCommandHandler>>();
        var handler = new CreateOrderCommandHandler(mockRepository.Object, mockLogger.Object);
        
        var command = new CreateOrderCommand
        {
            CustomerName = "John Doe",
            Email = "john@example.com",
            TotalAmount = 99.99m
        };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.NotEqual(Guid.Empty, result);
        mockRepository.Verify(
            x => x.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()), 
            Times.Once);
    }
}
```
