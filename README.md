# RentBuddy Server: Master Architecture & Production Flow

![RentBuddy System Architecture](file:///C:/Users/Ashil/Documents/workspace/projects/Rentbuddy/RentBuddy/server/rentbuddy_system_architecture_master.png)

This README provides the definitive technical and visual blueprint of the RentBuddy backend. It maps every line of code to the business logic required for a high-scale rental platform.

---

## 1. System Ecosystem (Master Flow)

### A. End-to-End Operational Lifecycle
*This Left-to-Right flow is optimized for wide screens and provides high-detail visibility into every layer.*

```mermaid
graph LR
    %% Global Styles
    classDef model fill:#f9f,stroke:#333,stroke-width:2px;
    classDef route fill:#bbf,stroke:#333,stroke-width:1px;
    classDef service fill:#bfb,stroke:#333,stroke-width:1px;
    classDef gateway fill:#f96,stroke:#333,stroke-width:2px;

    subgraph "DATA & INVENTORY"
        B1[(models/barcode.js)]
        B2[(models/product.js)]
        B3[(models/payment.js)]
        B4[(models/subscription.js)]
    end

    subgraph "INPUT"
        A1[addProducts.js] -->|Update| B2
        A1 -->|Insert| B1
    end

    subgraph "ORDER ENGINE"
        C1[addOrder.js] -->|Branch| D1{Type?}
        D1 -->|One-Time| E1[razorpay.js]
        D1 -->|Sub| E2[checkSubscriptionStatus.js]
        
        E1 -->|Verify| F1((FULFILLMENT))
        E2 -->|Verify| F1
    end

    subgraph "EXECUTION"
        F1 -->|Assign| B1
        F1 -->|Sync| B2
        F1 -->|Log| B3
    end

    subgraph "MONITOR"
        G1[razorpayWebhook.js] -->|Reset| B4
        I1[subscriptionReminder.cron.js] -->|Alert| K1[subscriptionNotifier.js]
        K1 --> L1[email.service.js]
        K1 --> L2[whatsapp.service.js]
    end

    subgraph "ADMIN"
        M1[subscriptionSkipMonth.js] -->|Manual Skip| B4
        M2[refunds.js] -->|Release| B1
    end

    %% Links
    B3 -.->|Ref Link| B1
    B4 -.->|Flags| I1

    class B1,B2,B3,B4 model;
    class A1,C1,E1,E2,G1,I1,M1,M2 route;
    class K1,L1,L2 service;
    class E1,G1 gateway;
```

---

## 2. Advanced Path Logic: Cumulative vs Recurring

| Feature | Cumulative Flow (One-Time) | Recurring Flow (Subscription) |
| :--- | :--- | :--- |
| **Logic Root** | `routes/payments/razorpay.js` | `routes/payments/razorpayWebhook.js` |
| **Verification** | Client-side Signature + HMAC | Webhook Event Signature |
| **Fulfillment** | Instant (await-based) | Polling-based / Webhook-triggered |
| **Cycle Logic** | Fixed term (ends at period) | Auto-Renewing (monthly window) |

---

## 3. The "Smart Monitor": Continuous CRM Logic

Our system solves the "Spam Problem" common in automated billing.

```mermaid
sequenceDiagram
    participant C as Cron Job (10 AM)
    participant D as Database (subscription.js)
    participant N as Notifier (WA/Email)
    participant W as Webhook (RZP)

    C->>D: Find 'active' users with due dates
    D->>C: Return list + current flags
    C->>C: Check: notifiedDue == true?
    alt Not Notified
        C->>N: Send "Payment Due" Alert
        C->>D: Set notifiedDue = true
    else Already Notified
        C-->>C: Skip (Prevent Spam)
    end
    
    Note over W,D: When Payment Hits...
    W->>D: Reset ALL flags (notifiedDue=false)
    Note over D: Cycle "Re-Armed" for next month
```

---

## 4. Technical Specifications & Edge Cases

### A. The "Month-Aware" Billing Window
To handle the "Feb 28th" problem, we use the `setMonth(-1)` strategy:
- **Calculation**: `hasPaidThisCycle = lastPaymentAt >= nextChargeAt` (comparing dates only)
- **Leap Year Safe**: Handles February variations perfectly.
- **28th->2nd Edge Case**: Verified. A payment on Jan 28th correctly covers a due date of Feb 2nd.

### B. Global Resiliency
- **WhatsApp Dynamic Detection**: `whatsapp.service.js` automatically converts `+91999...`, `91999...`, or `999...` into the standardized format required by the Meta Graph API.
- **Fail-Safe SMTP**: The email engine is designed to handle isolated failures. If one network timeout occurs, the system logs it and continues processing the remaining user queue without crashing the process.

### C. Manual Admin Recovery
When an Admin marks a month as **Manual Skip**:
1.  Status moves to `active` instantly.
2.  `missedPayments` is reset to 0.
3.  **Critical**: All notification flags are cleared, effectively silence any pending "Strict" or "Grace" reminders for that month.

---
**RentBuddy Master Infrastructure** | *Designed for Precision, Built for Scale*
