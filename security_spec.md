# Security Specification - ECOMMIL Pro

## Data Invariants
1. **User Profile**: Every user must have a profile in `/users/{userId}` where `{userId}` matches their Auth UID.
2. **Order Ownership**: Every order in `/orders/{orderId}` must have a `uid` field matching the creator's Auth UID.
3. **Expense Ownership**: Every advertising expense in `/ad_expenses/{expenseId}` must have a `uid` field matching the creator's Auth UID.
4. **Research Ownership**: Every market research record in `/market_research/{researchId}` must have a `uid` field matching the creator's Auth UID.
5. **Admin Access**: Users with the `admin` role (verified by a trusted document) can read all collections.

## The "Dirty Dozen" Payloads (Denial Expected)

1. **Identity Spoofing (Users)**: Creating a user profile for a different UID.
   - Payload: `{ "uid": "OTHER_UID", "email": "test@test.com", "role": "client" }` to `/users/MY_UID`
2. **Privilege Escalation**: A non-admin user trying to set their own role to 'admin'.
   - Payload: `{ "uid": "MY_UID", "email": "test@test.com", "role": "admin" }`
3. **Identity Spoofing (Orders)**: Creating an order with someone else's `uid`.
   - Payload: `{ "id": "1", "orderId": "ORD1", "uid": "OTHER_UID", ... }`
4. **Orphaned Write (Orders)**: Creating an order without a `uid`.
   - Payload: `{ "id": "1", "orderId": "ORD1", "date": "...", ... }`
5. **Update Gap (Orders)**: Updating an order's `uid` after creation.
   - Payload: `{ "uid": "OTHER_UID" }` (on an existing doc)
6. **Value Poisoning (Orders)**: Injecting a massive string into the `product` field.
   - Payload: `{ "product": "A".repeat(2000) }`
7. **Type Poisoning (Expenses)**: Setting `amount` as a string instead of a number.
   - Payload: `{ "amount": "100" }`
8. **Malicious ID**: Creating a document with a path-injection-style ID.
   - Path: `/orders/../../others/doc`
9. **Unverified List Scraping**: Attempting to list all orders without a `uid` filter.
   - Query: `db.collection('orders').get()`
10. **State Shortcut**: Updating an order to a terminal status without following workflow (if applicable).
11. **PII Leakage**: Reading another user's profile.
    - Path: `/users/OTHER_UID`
12. **Denial of Wallet**: Repeatedly querying with massive, unindexed, or unauthorized filters.

## Test Runner (Logic Verification)
The `firestore.rules.test.ts` will verify these scenarios.
