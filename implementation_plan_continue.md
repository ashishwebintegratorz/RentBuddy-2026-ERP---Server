# [NEW] Continue Subscription Feature

Allow users to extend their existing rental agreements directly. Users can choose to pay for the extension up-front (Full) or continue their monthly automated billing (Recurring).

## User Review Required

> [!IMPORTANT]
> **Admin Dashboard Integration**: While the backend will support this, you will need to add a button on your UI to call these new endpoints. I will ensure the API is easy to use.

> [!WARNING]
> **Razorpay Limits**: When extending for 'Recurring' payments, I will be updating the `total_count` on the active Razorpay subscription. This will only work if the subscription is still `active` or `authenticated`.

## Proposed Changes

### Subscription Management

---

#### [NEW] [continueSubscription.js](file:///d:/New-RentBuddy-Fix-Version---Server/routes/payments/continueSubscription.js)
- **Endpoint**: `POST /api/payments/continue`
- **Functionality**:
  - Accept `subscriptionId` or `rentalId` and `extensionMonths`.
  - **Option: Recurring**:
    - Calculate new `total_count`.
    - Update Razorpay subscription.
    - Extend `rentedTill` and `totalPaymentsRequired` in the `Rental` model.
  - **Option: Full**:
    - Calculate `totalExtensionAmount` (monthly rate × months).
    - Create a Razorpay `Order` or `Payment Link`.
    - On payment (via webhook), move the dates forward by `extensionMonths` and mark the extra months as `paid`.

#### [MODIFY] [routes.js](file:///d:/New-RentBuddy-Fix-Version---Server/routes/routes.js)
- Register the new `continueSubscription` router.

#### [MODIFY] [razorpayWebhook.js](file:///d:/New-RentBuddy-Fix-Version---Server/routes/payments/razorpayWebhook.js)
- Add logic to handle `payment.captured` for "Subscription Extension" orders.
- Identify extensions via `receipt` or `notes` (e.g., `type: 'extension'`).

---

## Open Questions

- **Pricing**: Should the extension use the same monthly rate as the original plan, or should it be configurable? (Current plan: Use existing plan rate).
- **Grace Period**: If a user is `past_due`, should they be allowed to "Continue"? (Recommendation: Only if they pay the arrears first, or if 'Full' payment covers everything).

## Verification Plan

### Automated/Manual Tests
1.  **Test Recurring Extension**: Call the endpoint and verify on the Razorpay Dashboard that `total_count` increased.
2.  **Test Full Upfront Extension**: Trigger the endpoint, simulate a successful webhook, and verify `rentedTill` pushed forward by the correct number of months.
