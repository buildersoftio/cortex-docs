---
title: Notifications
description: Notifications with Cortex.Mediator
---


# Notifications (Events)

Notifications represent **domain events** in your application - something that has happened that other parts of the system might be interested in. They enable event-driven architecture where multiple handlers can react to a single event.

## What is a Notification?

A notification (or event) is a message that informs the system that something has occurred, such as:
- User registered
- Order placed
- Payment processed
- Email sent
- Data imported

Unlike commands and queries, notifications can have **zero, one, or many handlers**, and they don't return values.

## Creating Notifications

### Simple Notification

```csharp
using Cortex.Mediator.Notifications;

public class UserRegisteredNotification : INotification
{
    public Guid UserId { get; set; }
    public string Email { get; set; }
    public string FullName { get; set; }
    public DateTime RegisteredAt { get; set; }
}
```

### Notification with Rich Data

```csharp
public class OrderPlacedNotification : INotification
{
    public Guid OrderId { get; set; }
    public Guid CustomerId { get; set; }
    public string CustomerEmail { get; set; }
    public string CustomerName { get; set; }
    public List<OrderItemDto> Items { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTime PlacedAt { get; set; }
    public string ShippingAddress { get; set; }
}

public class OrderItemDto
{
    public string ProductName { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
}
```

## Implementing Notification Handlers

### Single Handler

```csharp
using Cortex.Mediator.Notifications;

public class SendWelcomeEmailHandler : INotificationHandler<UserRegisteredNotification>
{
    private readonly IEmailService _emailService;
    private readonly ILogger<SendWelcomeEmailHandler> _logger;

    public SendWelcomeEmailHandler(
        IEmailService emailService,
        ILogger<SendWelcomeEmailHandler> logger)
    {
        _emailService = emailService;
        _logger = logger;
    }

    public async Task Handle(
        UserRegisteredNotification notification,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Sending welcome email to {Email}",
            notification.Email);

        await _emailService.SendWelcomeEmailAsync(
            notification.Email,
            notification.FullName,
            cancellationToken);

        _logger.LogInformation(
            "Welcome email sent successfully to {Email}",
            notification.Email);
    }
}
```

### Multiple Handlers for Same Notification

```csharp
// Handler 1: Send welcome email
public class SendWelcomeEmailHandler : INotificationHandler<UserRegisteredNotification>
{
    private readonly IEmailService _emailService;

    public SendWelcomeEmailHandler(IEmailService emailService)
    {
        _emailService = emailService;
    }

    public async Task Handle(
        UserRegisteredNotification notification,
        CancellationToken cancellationToken)
    {
        await _emailService.SendWelcomeEmailAsync(
            notification.Email,
            notification.FullName,
            cancellationToken);
    }
}

// Handler 2: Create user profile
public class CreateUserProfileHandler : INotificationHandler<UserRegisteredNotification>
{
    private readonly IProfileRepository _profileRepository;

    public CreateUserProfileHandler(IProfileRepository profileRepository)
    {
        _profileRepository = profileRepository;
    }

    public async Task Handle(
        UserRegisteredNotification notification,
        CancellationToken cancellationToken)
    {
        var profile = new UserProfile
        {
            UserId = notification.UserId,
            DisplayName = notification.FullName,
            CreatedAt = DateTime.UtcNow
        };

        await _profileRepository.CreateAsync(profile, cancellationToken);
    }
}

// Handler 3: Track analytics
public class TrackUserRegistrationHandler : INotificationHandler<UserRegisteredNotification>
{
    private readonly IAnalyticsService _analyticsService;

    public TrackUserRegistrationHandler(IAnalyticsService analyticsService)
    {
        _analyticsService = analyticsService;
    }

    public async Task Handle(
        UserRegisteredNotification notification,
        CancellationToken cancellationToken)
    {
        await _analyticsService.TrackEventAsync("user_registered", new
        {
            user_id = notification.UserId,
            registered_at = notification.RegisteredAt
        });
    }
}

// Handler 4: Send to message queue
public class PublishUserRegisteredHandler : INotificationHandler<UserRegisteredNotification>
{
    private readonly IMessageBus _messageBus;

    public PublishUserRegisteredHandler(IMessageBus messageBus)
    {
        _messageBus = messageBus;
    }

    public async Task Handle(
        UserRegisteredNotification notification,
        CancellationToken cancellationToken)
    {
        await _messageBus.PublishAsync(
            "user.registered",
            notification,
            cancellationToken);
    }
}
```

All four handlers will be called automatically when you publish `UserRegisteredNotification`!

## Publishing Notifications

### From a Command Handler

```csharp
public class RegisterUserCommandHandler : ICommandHandler<RegisterUserCommand, Guid>
{
    private readonly IUserRepository _userRepository;
    private readonly IMediator _mediator;

    public RegisterUserCommandHandler(
        IUserRepository userRepository,
        IMediator mediator)
    {
        _userRepository = userRepository;
        _mediator = mediator;
    }

    public async Task<Guid> Handle(
        RegisterUserCommand command,
        CancellationToken cancellationToken)
    {
        // Create user
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = command.Email,
            FirstName = command.FirstName,
            LastName = command.LastName,
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.AddAsync(user, cancellationToken);
        await _userRepository.SaveChangesAsync(cancellationToken);

        // Publish notification - all handlers will be called
        await _mediator.PublishAsync(new UserRegisteredNotification
        {
            UserId = user.Id,
            Email = user.Email,
            FullName = $"{user.FirstName} {user.LastName}",
            RegisteredAt = user.CreatedAt
        }, cancellationToken);

        return user.Id;
    }
}
```

### From a Controller

```csharp
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly IMediator _mediator;

    public OrdersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("{orderId}/ship")]
    public async Task<IActionResult> ShipOrder(Guid orderId)
    {
        // ... ship the order ...

        // Publish notification
        await _mediator.PublishAsync(new OrderShippedNotification
        {
            OrderId = orderId,
            ShippedAt = DateTime.UtcNow
        });

        return Ok();
    }
}
```

## Real-World Examples

### Example 1: Order Processing Workflow

```csharp
// Notification
public class OrderPlacedNotification : INotification
{
    public Guid OrderId { get; set; }
    public Guid CustomerId { get; set; }
    public string CustomerEmail { get; set; }
    public decimal TotalAmount { get; set; }
    public List<OrderItemDto> Items { get; set; }
}

// Handler 1: Send confirmation email
public class SendOrderConfirmationHandler : INotificationHandler<OrderPlacedNotification>
{
    private readonly IEmailService _emailService;
    private readonly ILogger<SendOrderConfirmationHandler> _logger;

    public SendOrderConfirmationHandler(
        IEmailService emailService,
        ILogger<SendOrderConfirmationHandler> logger)
    {
        _emailService = emailService;
        _logger = logger;
    }

    public async Task Handle(
        OrderPlacedNotification notification,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Sending order confirmation for order {OrderId}",
            notification.OrderId);

        var emailBody = BuildOrderConfirmationEmail(notification);
        
        await _emailService.SendEmailAsync(
            notification.CustomerEmail,
            "Order Confirmation",
            emailBody,
            cancellationToken);
    }

    private string BuildOrderConfirmationEmail(OrderPlacedNotification notification)
    {
        // Build HTML email with order details
        return $@"
            <h1>Thank you for your order!</h1>
            <p>Order ID: {notification.OrderId}</p>
            <p>Total: ${notification.TotalAmount:F2}</p>
            <h2>Items:</h2>
            <ul>
            {string.Join("", notification.Items.Select(i => 
                $"<li>{i.ProductName} x {i.Quantity} - ${i.Price:F2}</li>"))}
            </ul>
        ";
    }
}

// Handler 2: Update inventory
public class UpdateInventoryHandler : INotificationHandler<OrderPlacedNotification>
{
    private readonly IInventoryService _inventoryService;
    private readonly ILogger<UpdateInventoryHandler> _logger;

    public UpdateInventoryHandler(
        IInventoryService inventoryService,
        ILogger<UpdateInventoryHandler> logger)
    {
        _inventoryService = inventoryService;
        _logger = logger;
    }

    public async Task Handle(
        OrderPlacedNotification notification,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Updating inventory for order {OrderId}",
            notification.OrderId);

        foreach (var item in notification.Items)
        {
            await _inventoryService.ReduceStockAsync(
                item.ProductName,
                item.Quantity,
                cancellationToken);
        }

        _logger.LogInformation(
            "Inventory updated for order {OrderId}",
            notification.OrderId);
    }
}

// Handler 3: Create shipment
public class CreateShipmentHandler : INotificationHandler<OrderPlacedNotification>
{
    private readonly IShippingService _shippingService;

    public CreateShipmentHandler(IShippingService shippingService)
    {
        _shippingService = shippingService;
    }

    public async Task Handle(
        OrderPlacedNotification notification,
        CancellationToken cancellationToken)
    {
        await _shippingService.CreateShipmentAsync(
            notification.OrderId,
            notification.Items,
            cancellationToken);
    }
}

// Handler 4: Trigger loyalty points
public class AwardLoyaltyPointsHandler : INotificationHandler<OrderPlacedNotification>
{
    private readonly ILoyaltyService _loyaltyService;

    public AwardLoyaltyPointsHandler(ILoyaltyService loyaltyService)
    {
        _loyaltyService = loyaltyService;
    }

    public async Task Handle(
        OrderPlacedNotification notification,
        CancellationToken cancellationToken)
    {
        var points = CalculatePoints(notification.TotalAmount);
        
        await _loyaltyService.AwardPointsAsync(
            notification.CustomerId,
            points,
            $"Order {notification.OrderId}",
            cancellationToken);
    }

    private int CalculatePoints(decimal amount)
    {
        return (int)(amount * 10); // 10 points per dollar
    }
}

// Handler 5: Send to analytics
public class TrackOrderAnalyticsHandler : INotificationHandler<OrderPlacedNotification>
{
    private readonly IAnalyticsService _analyticsService;

    public TrackOrderAnalyticsHandler(IAnalyticsService analyticsService)
    {
        _analyticsService = analyticsService;
    }

    public async Task Handle(
        OrderPlacedNotification notification,
        CancellationToken cancellationToken)
    {
        await _analyticsService.TrackEventAsync("order_placed", new
        {
            order_id = notification.OrderId,
            customer_id = notification.CustomerId,
            total_amount = notification.TotalAmount,
            item_count = notification.Items.Count
        });
    }
}
```

### Example 2: User Activity Tracking

```csharp
// Base notification for user activities
public class UserActivityNotification : INotification
{
    public Guid UserId { get; set; }
    public string ActivityType { get; set; }
    public DateTime Timestamp { get; set; }
    public Dictionary<string, object> Metadata { get; set; }
}

// Handler 1: Log to database
public class LogUserActivityHandler : INotificationHandler<UserActivityNotification>
{
    private readonly IActivityLogRepository _activityLogRepository;

    public LogUserActivityHandler(IActivityLogRepository activityLogRepository)
    {
        _activityLogRepository = activityLogRepository;
    }

    public async Task Handle(
        UserActivityNotification notification,
        CancellationToken cancellationToken)
    {
        var log = new ActivityLog
        {
            UserId = notification.UserId,
            ActivityType = notification.ActivityType,
            Timestamp = notification.Timestamp,
            Metadata = JsonSerializer.Serialize(notification.Metadata)
        };

        await _activityLogRepository.AddAsync(log, cancellationToken);
    }
}

// Handler 2: Update user's last active
public class UpdateLastActiveHandler : INotificationHandler<UserActivityNotification>
{
    private readonly IUserRepository _userRepository;

    public UpdateLastActiveHandler(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task Handle(
        UserActivityNotification notification,
        CancellationToken cancellationToken)
    {
        await _userRepository.UpdateLastActiveAsync(
            notification.UserId,
            notification.Timestamp,
            cancellationToken);
    }
}

// Handler 3: Send to real-time dashboard
public class PushToRealtimeDashboardHandler : INotificationHandler<UserActivityNotification>
{
    private readonly IHubContext<DashboardHub> _hubContext;

    public PushToRealtimeDashboardHandler(IHubContext<DashboardHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task Handle(
        UserActivityNotification notification,
        CancellationToken cancellationToken)
    {
        await _hubContext.Clients.All.SendAsync(
            "UserActivity",
            notification,
            cancellationToken);
    }
}
```

### Example 3: Integration Events

```csharp
// Payment processed notification
public class PaymentProcessedNotification : INotification
{
    public Guid PaymentId { get; set; }
    public Guid OrderId { get; set; }
    public decimal Amount { get; set; }
    public string TransactionId { get; set; }
    public bool Success { get; set; }
    public DateTime ProcessedAt { get; set; }
}

// Handler 1: Update order status
public class UpdateOrderStatusHandler : INotificationHandler<PaymentProcessedNotification>
{
    private readonly IOrderRepository _orderRepository;

    public UpdateOrderStatusHandler(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }

    public async Task Handle(
        PaymentProcessedNotification notification,
        CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(
            notification.OrderId,
            cancellationToken);

        if (order != null)
        {
            order.PaymentStatus = notification.Success 
                ? PaymentStatus.Paid 
                : PaymentStatus.Failed;
            order.TransactionId = notification.TransactionId;
            
            await _orderRepository.UpdateAsync(order, cancellationToken);
        }
    }
}

// Handler 2: Send notification to customer
public class SendPaymentNotificationHandler : INotificationHandler<PaymentProcessedNotification>
{
    private readonly IEmailService _emailService;
    private readonly IOrderRepository _orderRepository;

    public SendPaymentNotificationHandler(
        IEmailService emailService,
        IOrderRepository orderRepository)
    {
        _emailService = emailService;
        _orderRepository = orderRepository;
    }

    public async Task Handle(
        PaymentProcessedNotification notification,
        CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetByIdAsync(
            notification.OrderId,
            cancellationToken);

        if (order != null)
        {
            var subject = notification.Success
                ? "Payment Successful"
                : "Payment Failed";

            var body = notification.Success
                ? $"Your payment of ${notification.Amount:F2} has been processed successfully."
                : $"We were unable to process your payment of ${notification.Amount:F2}. Please try again.";

            await _emailService.SendEmailAsync(
                order.CustomerEmail,
                subject,
                body,
                cancellationToken);
        }
    }
}

// Handler 3: Publish to message bus for other microservices
public class PublishPaymentEventHandler : INotificationHandler<PaymentProcessedNotification>
{
    private readonly IMessageBus _messageBus;

    public PublishPaymentEventHandler(IMessageBus messageBus)
    {
        _messageBus = messageBus;
    }

    public async Task Handle(
        PaymentProcessedNotification notification,
        CancellationToken cancellationToken)
    {
        await _messageBus.PublishAsync(
            "payments.processed",
            new
            {
                payment_id = notification.PaymentId,
                order_id = notification.OrderId,
                amount = notification.Amount,
                success = notification.Success,
                transaction_id = notification.TransactionId,
                processed_at = notification.ProcessedAt
            },
            cancellationToken);
    }
}
```

## Notification Execution Order

Handlers are executed **sequentially** in the order they are registered in the DI container. If one handler throws an exception, subsequent handlers may not execute (unless exception handling behavior is configured).

```csharp
// Handlers execute in registration order:
// 1. SendWelcomeEmailHandler
// 2. CreateUserProfileHandler
// 3. TrackUserRegistrationHandler
// 4. PublishUserRegisteredHandler
```

## Exception Handling in Notifications

By default, if a notification handler throws an exception, it will propagate up. You can use the Exception Handling behavior to suppress exceptions:

```csharp
// Add exception handling for notifications
builder.Services.AddCortexMediator(
    new[] { typeof(Program).Assembly },
    options => options.AddExceptionHandlingBehaviors()
);

// The ExceptionHandlingNotificationBehavior will log exceptions
// and optionally suppress them to allow other handlers to continue
```

## Best Practices

### DO

- **Keep handlers independent** - Each handler should work standalone
- **Use for side effects** - Sending emails, logging, analytics
- **Make notifications immutable** - Use init-only properties
- **Name events in past tense** - `UserRegistered`, not `RegisterUser`
- **Include relevant data** - Handlers shouldn't need to query for more data
- **Log in handlers** - Track what each handler does
- **Handle failures gracefully** - Don't let one handler failure stop others

### DON'T

- **Don't use for required operations** - Use commands instead
- **Don't expect specific order** - Handlers should be independent
- **Don't return values** - Notifications are fire-and-forget
- **Don't perform long-running operations** - Consider background jobs
- **Don't create circular dependencies** - Avoid publishing notifications from notification handlers

## Notification Naming Conventions

```csharp
// Good names (past tense, descriptive)
UserRegisteredNotification
OrderPlacedNotification
PaymentProcessedNotification
EmailSentNotification
DataImportedNotification
AccountActivatedNotification

// Bad names
UserNotification           // Too generic
RegisterUserNotification   // Wrong tense (should be past)
OrderNotification          // Not descriptive
ProcessNotification        // Too vague
```

## Testing Notification Handlers

```csharp
public class SendWelcomeEmailHandlerTests
{
    [Fact]
    public async Task Handle_ValidNotification_SendsEmail()
    {
        // Arrange
        var mockEmailService = new Mock<IEmailService>();
        var handler = new SendWelcomeEmailHandler(
            mockEmailService.Object,
            Mock.Of<ILogger<SendWelcomeEmailHandler>>());

        var notification = new UserRegisteredNotification
        {
            UserId = Guid.NewGuid(),
            Email = "test@example.com",
            FullName = "John Doe",
            RegisteredAt = DateTime.UtcNow
        };

        // Act
        await handler.Handle(notification, CancellationToken.None);

        // Assert
        mockEmailService.Verify(
            x => x.SendWelcomeEmailAsync(
                notification.Email,
                notification.FullName,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_EmailServiceThrows_PropagatesException()
    {
        // Arrange
        var mockEmailService = new Mock<IEmailService>();
        mockEmailService
            .Setup(x => x.SendWelcomeEmailAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new EmailServiceException("Service unavailable"));

        var handler = new SendWelcomeEmailHandler(
            mockEmailService.Object,
            Mock.Of<ILogger<SendWelcomeEmailHandler>>());

        var notification = new UserRegisteredNotification
        {
            Email = "test@example.com",
            FullName = "John Doe"
        };

        // Act & Assert
        await Assert.ThrowsAsync<EmailServiceException>(() =>
            handler.Handle(notification, CancellationToken.None));
    }
}
```