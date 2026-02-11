# Database Schema Documentation

## Jeweller Pricing Platform - PostgreSQL Database

This document describes the complete database structure for the Jeweller Pricing Platform.

---

## Table of Contents

1. [Users](#1-users)
2. [Customers](#2-customers)
3. [Categories](#3-categories)
4. [Items](#4-items)
5. [Suppliers](#5-suppliers)
6. [Materials](#6-materials)
7. [Metal Prices](#7-metal_prices)
8. [Exchange Rates](#8-exchange_rates)
9. [Quotes](#9-quotes)
10. [Quote Items](#10-quote_items)
11. [Quote Versions](#11-quote_versions)
12. [Settings](#12-settings)
13. [Enums](#enums)
14. [Entity Relationship Diagram](#entity-relationship-diagram)

---

## 1. users

Single user authentication table for the jeweller.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `email` | `String` | UNIQUE, NOT NULL | User email address |
| `password` | `String` | NOT NULL | Hashed password |
| `name` | `String` | NOT NULL | User display name |
| `created_at` | `DateTime` | DEFAULT now() | Record creation timestamp |
| `updated_at` | `DateTime` | AUTO UPDATE | Last update timestamp |

---

## 2. customers

Client database for storing customer information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `name` | `String` | NOT NULL | Customer name |
| `company` | `String` | NULLABLE | Company name |
| `email` | `String` | NULLABLE | Email address |
| `phone` | `String` | NULLABLE | Phone number |
| `address` | `String` | NULLABLE | Physical address |
| `notes` | `String` | NULLABLE | Additional notes |
| `created_at` | `DateTime` | DEFAULT now() | Record creation timestamp |
| `updated_at` | `DateTime` | AUTO UPDATE | Last update timestamp |

**Relationships:**
- Has many `quotes`

---

## 3. categories

Item categories for organizing jewellery products.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `name` | `String` | UNIQUE, NOT NULL | Category name (e.g., "Rings", "Earrings") |
| `description` | `String` | NULLABLE | Category description |
| `created_at` | `DateTime` | DEFAULT now() | Record creation timestamp |
| `updated_at` | `DateTime` | AUTO UPDATE | Last update timestamp |

**Relationships:**
- Has many `items`

---

## 4. items

Jewellery items/products catalog.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `sku` | `String` | UNIQUE, NOT NULL | Stock Keeping Unit |
| `name` | `String` | NOT NULL | Item name |
| `description` | `String` | NULLABLE | Item description |
| `category_id` | `String` | FOREIGN KEY, NOT NULL | Reference to categories |
| `base_price` | `Decimal(12,2)` | NULLABLE | Base price in ZAR |
| `image_url` | `String` | NULLABLE | Product image URL |
| `is_active` | `Boolean` | DEFAULT true | Whether item is active |
| `created_at` | `DateTime` | DEFAULT now() | Record creation timestamp |
| `updated_at` | `DateTime` | AUTO UPDATE | Last update timestamp |

**Relationships:**
- Belongs to `categories` (via `category_id`)
- Has many `quote_items`

---

## 5. suppliers

Material suppliers database.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `name` | `String` | NOT NULL | Supplier name |
| `contact_name` | `String` | NULLABLE | Contact person name |
| `email` | `String` | NULLABLE | Email address |
| `phone` | `String` | NULLABLE | Phone number |
| `address` | `String` | NULLABLE | Physical address |
| `website` | `String` | NULLABLE | Website URL |
| `notes` | `String` | NULLABLE | Additional notes |
| `created_at` | `DateTime` | DEFAULT now() | Record creation timestamp |
| `updated_at` | `DateTime` | AUTO UPDATE | Last update timestamp |

**Relationships:**
- Has many `materials`

---

## 6. materials

Raw materials from suppliers (gemstones, findings, chains, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `name` | `String` | NOT NULL | Material name |
| `type` | `String` | NOT NULL | Type: "gemstone", "finding", "chain", "clasp", "setting", "wire", "other" |
| `unit` | `String` | NOT NULL | Unit of measure: "piece", "gram", "carat", "meter", "cm" |
| `price_per_unit` | `Decimal(12,4)` | NOT NULL | Price per unit |
| `currency` | `String` | DEFAULT 'ZAR' | Currency code |
| `supplier_id` | `String` | FOREIGN KEY, NULLABLE | Reference to suppliers |
| `sku` | `String` | NULLABLE | Supplier SKU |
| `description` | `String` | NULLABLE | Material description |
| `in_stock` | `Boolean` | DEFAULT true | Stock availability |
| `last_updated` | `DateTime` | DEFAULT now() | Last price update |
| `created_at` | `DateTime` | DEFAULT now() | Record creation timestamp |
| `updated_at` | `DateTime` | AUTO UPDATE | Last update timestamp |

**Relationships:**
- Belongs to `suppliers` (via `supplier_id`, optional)

---

## 7. metal_prices

Live precious metal prices fetched from external APIs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `metal_type` | `String` | NOT NULL | Metal type: "gold", "silver", "platinum", "palladium", "rhodium" |
| `karat` | `Int` | NULLABLE | For gold: 9, 14, 18, 22, 24 |
| `purity` | `Decimal(5,2)` | NULLABLE | Percentage purity |
| `price_usd` | `Decimal(12,4)` | NOT NULL | Price per gram in USD |
| `price_zar` | `Decimal(12,4)` | NOT NULL | Price per gram in ZAR |
| `fetched_at` | `DateTime` | DEFAULT now() | When price was fetched |

**Unique Constraint:** `(metal_type, karat)`

---

## 8. exchange_rates

Currency conversion rates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `from_currency` | `String` | NOT NULL | Source currency code (e.g., "USD") |
| `to_currency` | `String` | NOT NULL | Target currency code (e.g., "ZAR") |
| `rate` | `Decimal(12,6)` | NOT NULL | Exchange rate |
| `fetched_at` | `DateTime` | DEFAULT now() | When rate was fetched |

**Unique Constraint:** `(from_currency, to_currency)`

---

## 9. quotes

Customer quotes/estimates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `quote_number` | `String` | UNIQUE, NOT NULL | Quote reference number |
| `customer_id` | `String` | FOREIGN KEY, NOT NULL | Reference to customers |
| `status` | `QuoteStatus` | DEFAULT 'DRAFT' | Quote status (see Enums) |
| `subtotal` | `Decimal(12,2)` | DEFAULT 0 | Subtotal before markup |
| `markup_pct` | `Decimal(5,2)` | DEFAULT 0 | Markup percentage |
| `markup_amt` | `Decimal(12,2)` | DEFAULT 0 | Markup amount |
| `discount` | `Decimal(12,2)` | DEFAULT 0 | Discount amount |
| `total_zar` | `Decimal(12,2)` | DEFAULT 0 | Final total in ZAR |
| `notes` | `String` | NULLABLE | Quote notes |
| `valid_until` | `DateTime` | NULLABLE | Quote expiry date |
| `version` | `Int` | DEFAULT 1 | Current version number |
| `created_at` | `DateTime` | DEFAULT now() | Record creation timestamp |
| `updated_at` | `DateTime` | AUTO UPDATE | Last update timestamp |

**Relationships:**
- Belongs to `customers` (via `customer_id`)
- Has many `quote_items`
- Has many `quote_versions`

---

## 10. quote_items

Line items within a quote.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `quote_id` | `String` | FOREIGN KEY, NOT NULL | Reference to quotes |
| `item_id` | `String` | FOREIGN KEY, NULLABLE | Reference to items |
| `description` | `String` | NOT NULL | Line item description |
| `quantity` | `Int` | DEFAULT 1 | Quantity |
| `labour_hours` | `Decimal(6,2)` | DEFAULT 0 | Labour hours |
| `labour_rate` | `Decimal(10,2)` | DEFAULT 0 | Labour rate per hour |
| `labour_total` | `Decimal(12,2)` | DEFAULT 0 | Total labour cost |
| `metal_type` | `String` | NULLABLE | Metal type used |
| `metal_karat` | `Int` | NULLABLE | Metal karat (for gold) |
| `metal_grams` | `Decimal(8,3)` | DEFAULT 0 | Metal weight in grams |
| `metal_price` | `Decimal(12,4)` | DEFAULT 0 | Metal price per gram |
| `metal_total` | `Decimal(12,2)` | DEFAULT 0 | Total metal cost |
| `accessories` | `Json` | NULLABLE | Array of accessories with name and price |
| `extras_total` | `Decimal(12,2)` | DEFAULT 0 | Total accessories cost |
| `unit_price` | `Decimal(12,2)` | DEFAULT 0 | Unit price |
| `line_total` | `Decimal(12,2)` | DEFAULT 0 | Line total |
| `notes` | `String` | NULLABLE | Line item notes |
| `sort_order` | `Int` | DEFAULT 0 | Display order |
| `created_at` | `DateTime` | DEFAULT now() | Record creation timestamp |
| `updated_at` | `DateTime` | AUTO UPDATE | Last update timestamp |

**Relationships:**
- Belongs to `quotes` (via `quote_id`, CASCADE DELETE)
- Belongs to `items` (via `item_id`, optional)

---

## 11. quote_versions

Version history for quotes (audit trail).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `quote_id` | `String` | FOREIGN KEY, NOT NULL | Reference to quotes |
| `version_num` | `Int` | NOT NULL | Version number |
| `snapshot_json` | `Json` | NOT NULL | Full quote snapshot |
| `change_notes` | `String` | NULLABLE | Notes about changes |
| `created_at` | `DateTime` | DEFAULT now() | Record creation timestamp |

**Unique Constraint:** `(quote_id, version_num)`

**Relationships:**
- Belongs to `quotes` (via `quote_id`, CASCADE DELETE)

---

## 12. settings

Application configuration settings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `String` | PRIMARY KEY, CUID | Unique identifier |
| `key` | `String` | UNIQUE, NOT NULL | Setting key |
| `value` | `String` | NOT NULL | Setting value |
| `description` | `String` | NULLABLE | Setting description |
| `updated_at` | `DateTime` | AUTO UPDATE | Last update timestamp |

**Common Settings:**
- `business_name` - Business name
- `business_address` - Business address
- `business_phone` - Business phone
- `business_email` - Business email
- `default_labour_rate` - Default labour rate per hour
- `default_markup_pct` - Default markup percentage
- `quote_validity_days` - Default quote validity period
- `currency` - Base currency (ZAR)

---

## Enums

### QuoteStatus

| Value | Description |
|-------|-------------|
| `DRAFT` | Quote is being prepared |
| `SENT` | Quote sent to customer |
| `ACCEPTED` | Customer accepted the quote |
| `REJECTED` | Customer rejected the quote |
| `EXPIRED` | Quote validity period expired |
| `CONVERTED` | Quote converted to invoice (future feature) |

---

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐
│   users     │       │  settings   │
└─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐
│  customers  │───────│   quotes    │
└─────────────┘   1:N └─────────────┘
                           │
                           │ 1:N
                           ▼
                    ┌─────────────┐
                    │ quote_items │
                    └─────────────┘
                           │
                           │ N:1
                           ▼
┌─────────────┐       ┌─────────────┐
│ categories  │───────│    items    │
└─────────────┘   1:N └─────────────┘

┌─────────────┐       ┌─────────────┐
│  suppliers  │───────│  materials  │
└─────────────┘   1:N └─────────────┘

┌─────────────┐       ┌─────────────┐
│metal_prices │       │exchange_rates│
└─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐
│   quotes    │───────│quote_versions│
└─────────────┘   1:N └─────────────┘
```

---

## Indexes

The following indexes are automatically created:

- Primary keys on all `id` columns
- Unique index on `users.email`
- Unique index on `categories.name`
- Unique index on `items.sku`
- Unique index on `quotes.quote_number`
- Unique index on `settings.key`
- Composite unique index on `metal_prices(metal_type, karat)`
- Composite unique index on `exchange_rates(from_currency, to_currency)`
- Composite unique index on `quote_versions(quote_id, version_num)`
- Foreign key indexes on all relationship columns

---

## Notes

1. **Currency**: Base currency is ZAR (South African Rand). All prices are stored in ZAR with USD equivalents for metal prices.

2. **Decimal Precision**: 
   - Prices use `Decimal(12,2)` for currency amounts
   - Metal prices use `Decimal(12,4)` for precision
   - Exchange rates use `Decimal(12,6)` for accuracy

3. **Soft Deletes**: Not implemented. Records are hard deleted.

4. **Timestamps**: All tables include `created_at` and `updated_at` timestamps.

5. **IDs**: Using CUID (Collision-resistant Unique Identifiers) for all primary keys.