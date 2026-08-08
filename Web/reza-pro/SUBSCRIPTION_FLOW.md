# Subscription Flow (Manual Virement)

## Overview

Reza uses a **manual virement (bank transfer)** subscription model where admins declare payments, and superadmins manually approve them. This document explains the complete flow for both users and superadmins.

---

## For Admin Users (Tenants)

### 1. View What You Need to Pay
- Go to: **http://localhost:3001/dashboard/admin/mon-abonnement**
- See your current **Tarification** (pricing):
  - Frais par salon (one-time fee per salon)
  - Frais par employé (per employee beyond free threshold)
  - Optional tiered pricing (progressive pricing)
- See your **Votre facture** (your bill):
  - Breakdown of salon fees and employee fees
  - **Total amount due** (displayed prominently)
- See your **Couverture par salon** (coverage):
  - Which salons are covered/not covered by current subscription

### 2. Check Payment History
- See all past payment declarations under **Historique des paiements**
- Each payment shows:
  - Amount & currency
  - Payer name (who made the payment)
  - Status: En attente (Pending), Approuvé (Approved), or Refusé (Rejected)
  - Rejection reason (if applicable)
  - Declaration date
  - Bank transfer reference (if provided)

### 3. Declare a Payment (Make Payment Signal)
- Click **"Déclarer un virement"** button when you have an outstanding bill
- Fill out the declaration form:
  - **Nom du payeur** (Payer name) *required* — Who made the payment? Ex. "Wadii Boutou"
    - This helps superadmin confirm the payment sender
  - **Montant** (Amount) *required* — Pre-filled with your total due, can be edited
  - **Référence du virement** (Transfer reference) *optional* — Bank reference or date
- Click **"Confirmer la déclaration"**
- You'll see: **"Virement déclaré — en attente de validation par la plateforme dans 24h maximum."**
- Once submitted, you can't submit another declaration until this one is approved/rejected

### 4. How to Make the Actual Bank Transfer
- Click **"Voir les coordonnées bancaires de la plateforme"** link
- Transfer the declared amount to the platform's bank account
- Provide the declaration as proof (screenshot or confirmation)

### 5. Wait for Superadmin Approval
- Superadmin checks payments within **24 hours**
- Payment can be:
  - ✅ **Approved** — Your subscription period extends, salons become visible to clients
  - ❌ **Rejected** — See reason why (e.g., amount mismatch, payment not received)
- Once approved:
  - Period extends for +1 month from approval date
  - All salons become subscription-active and visible to clients
  - You can make another declaration if still outstanding fees remain

---

## For Superadmin (Platform Owner)

### 1. Access Superadmin Panel
- Go to: **http://localhost:3001/superadmin**
- Click **"Paiements"** tab

### 2. View Pending Payments
- Filter by status:
  - **En attente** (Pending) — payments awaiting your decision
  - **Approuvés** (Approved) — previously approved
  - **Refusés** (Rejected) — previously rejected
  - **Tous** (All) — all payments
- Each payment card shows:
  - **Amount & currency**
  - **Status badge** with icon
  - **Account owner** — the admin who made the declaration
  - **Salons** — which salons they cover
  - **Payer name** — who actually transferred the money (for verification)
  - **Declaration date & time**
  - **Bank reference** (if provided)
  - **Approval date** (if already approved)
  - **Rejection reason** (if rejected)

### 3. Verify & Approve Payment
- For each **PENDING** payment:
  1. Check the payer name matches the account owner or authorized person
  2. Verify the amount matches what was declared
  3. Confirm you've received the bank transfer
  4. Click **"Approuver"** button
- Effects of approval:
  - Payment status → **APPROVED**
  - Subscription status → **ACTIVE**
  - Coverage snapshot applied (salons paid, employees paid)
  - Period extended: `currentPeriodEnd = now + 1 month`
  - Salons become visible to clients
  - Notification system will alert the admin (future feature)

### 4. Reject Payment
- Click **"Refuser"** button on any PENDING payment
- A modal appears asking for **rejection reason** (optional)
- Examples of rejection reasons:
  - "Montant incorrect — reçu 1200, attendu 1400"
  - "Virement non reçu"
  - "Payer information ne correspond pas"
- After rejection:
  - Payment status → **REJECTED**
  - Admin can see the reason in their payment history
  - Admin can make a new payment declaration

### 5. Manage Billing Configuration
- Click **"Tarification"** tab to edit:
  - Price per salon (one-time fee)
  - Free employee threshold
  - Per-employee price
  - Tiered pricing (optional progressive pricing)

---

## Data Flow

### Payment States
1. **PENDING** → Admin submitted declaration, awaiting superadmin action
2. **APPROVED** → Superadmin approved, coverage snapshot applied, subscription active
3. **REJECTED** → Superadmin rejected (admin must resubmit with corrections)

### Payment Fields Stored
- `id` — unique identifier
- `accountId` — which admin account
- `amount` — declared transfer amount (MAD)
- `currency` — currency code
- `status` — PENDING | APPROVED | REJECTED
- `reference` — optional bank reference provided by admin
- `payerName` — name of person who made the transfer (user-provided)
- `details` — JSON snapshot of coverage at declaration time
- `rejectedReason` — reason for rejection (if applicable)
- `declaredById` — user who declared (usually account owner)
- `approvedById` — superadmin who approved (if applicable)
- `approvedAt` — timestamp of approval (if applicable)
- `createdAt` — declaration timestamp

---

## Timeline Example

**Admin: Wadii Boutou**
1. **Mon 9 AM** — Outstanding bill: 1400 MAD
   - Clicks "Déclarer un virement"
   - Fills: Payer name = "Wadii Boutou", Amount = 1400, Reference = "VIR-202408-001"
   - Status → PENDING

2. **Mon 11 AM** — Wadii makes bank transfer of 1400 MAD
   - Platform receives payment in bank account

3. **Tue 2 PM** — Superadmin checks payments
   - Sees Wadii's pending 1400 MAD
   - Verifies: payer name, amount received in bank
   - Clicks "Approuver"
   - Status → APPROVED
   - Subscription → ACTIVE (extended to Tue + 1 month)
   - All salons → visible to clients

4. **Tue 3 PM** — Wadii sees in dashboard
   - Payment history shows "Approuvé" with approval date
   - Bill now shows 0 MAD due (if all fees covered)
   - All salons show "Couvert" (covered)

---

## Environment Variables

Set in `Web/reza-pro/.env.local`:
```
NEXT_PUBLIC_PLATFORM_BANK_NAME=Banque Populaire
NEXT_PUBLIC_PLATFORM_BANK_HOLDER=Reza Platform
NEXT_PUBLIC_PLATFORM_BANK_IBAN=MA76 0000 0000 0000 0000 0000 000
```

Before production, configure with real bank details in your deployment environment.

---

## Key Points

✅ **Manual virement** — no Stripe, admins control timing and proof
✅ **Payer name verification** — superadmin can verify who actually sent money
✅ **24-hour SLA** — payments should be approved/rejected within 24h
✅ **Payment history** — both admin and superadmin see full audit trail
✅ **Rejection reasons** — clear feedback to admins if payment is rejected
✅ **One pending at a time** — prevents confusion and double-declares
✅ **Snapshot coverage** — what you pay for is locked at declaration time

