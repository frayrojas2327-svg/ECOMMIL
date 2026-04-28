# Security Specification

## Data Invariants
- An Order MUST have a valid `uid` matching the authenticated user.
- An Order MUST have a `date` and `status`.
- User profiles can only be read/written by the owner.

## The "Dirty Dozen" Payloads (Denial Expected)
1. Create Order with another user's `uid`.
2. Update Order's `uid` to another user.
3. Create Order with a 1MB string as `orderId`.
4. Update Order's `price` to a negative value.
5. Update Order's `status` to a value not in the enum.
6. Create User profile with `role: 'admin'`.
7. Update User profile `role` to `admin`.
8. Delete an Order belonging to another user.
9. List orders without filtered query (handled by rule enforcement).
10. Update `createdAt` field on an order.
11. Inject shadow field `isVerified: true` into an order.
12. Create Order with future `date` (if applicable, but we use server timestamp for system fields).

## Test Runner (Logic)
The following rules will enforce these invariants.
