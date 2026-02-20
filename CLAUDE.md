# Teslo Shop Backend - NestJS API

## Commands
- `npm run start:dev` - dev server with watch mode at http://localhost:3000
- `npm run build` - production build
- `npm run start` - production start (node dist/main)
- `GET /api/seed` - seed database with test data (deletes all existing data first)

## Architecture
NestJS 10 + TypeORM + PostgreSQL. All routes prefixed with `/api`.

### Modules
- **auth** - JWT auth with role-based access (`@Auth()` decorator)
- **products** - Product CRUD with images, pagination, gender filtering
- **cart** - Shopping cart (per-user, server-side)
- **orders** - Order creation, PayPhone payment flow, order history
- **payments** - PayPhone gateway integration (prepare + confirm)
- **files** - Image uploads
- **seed** - Database seeding (40+ products, 2 test users)
- **messages-ws** - WebSocket messaging

### Auth Pattern
- `@Auth()` - any authenticated user
- `@Auth(ValidRoles.admin)` - admin only
- `@GetUser()` - extract user from request
- JWT token in Authorization header: `Bearer <token>`

### Transaction Pattern (QueryRunner)
```typescript
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();
try {
  await queryRunner.manager.save(entity);
  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
} finally {
  await queryRunner.release();
}
```

## Database
- PostgreSQL 14.3 via Docker (`docker-compose.yaml`)
- `autoLoadEntities: true` + `synchronize: true` (auto-creates tables)
- Seed users: `test1@google.com` (admin), `test2@google.com` (user) - password: `Abc123`

## PayPhone Integration
- API base: `https://pay.payphonetodoesposible.com/api`
- `POST /api/button/Prepare` - create payment, get redirect URLs
- `POST /api/button/V2/Confirm` - confirm after user pays (must be within 5 min)
- Amounts in **cents** (multiply USD by 100)
- statusCode: 3 = Approved, 2 = Cancelled
- Env vars: `PAYPHONE_TOKEN`, `PAYPHONE_STORE_ID`, `FRONTEND_URL`

## Environment Variables (.env)
- `STAGE` - dev/prod (controls SSL)
- `DB_*` - PostgreSQL connection
- `PORT` - server port (3000)
- `JWT_SECRET` - JWT signing secret
- `PAYPHONE_TOKEN` - PayPhone Bearer token
- `PAYPHONE_STORE_ID` - PayPhone store identifier
- `FRONTEND_URL` - Frontend URL for PayPhone redirect callback

## API Endpoints

### Cart (all @Auth())
- `GET /api/cart` - get user's cart
- `POST /api/cart/items` - add item `{productId, quantity, size}`
- `PATCH /api/cart/items/:id` - update quantity `{quantity}`
- `DELETE /api/cart/items/:id` - remove item
- `DELETE /api/cart` - clear cart
- `POST /api/cart/merge` - merge guest cart `{items: [...]}`

### Orders (all @Auth())
- `POST /api/orders` - create order from cart (returns PayPhone URLs)
- `POST /api/orders/confirm` - confirm payment `{id, clientTransactionId}`
- `GET /api/orders` - user's order history (paginated)
- `GET /api/orders/:id` - order detail

## Key Files
- `src/main.ts` - app bootstrap, global prefix, CORS, validation
- `src/app.module.ts` - root module with all imports
- `src/auth/decorators/auth.decorator.ts` - composite @Auth() decorator
- `src/products/products.service.ts` - QueryRunner transaction pattern
- `src/cart/cart.service.ts` - cart CRUD + guest merge
- `src/orders/orders.service.ts` - order creation with row locks + payment
- `src/payments/payments.service.ts` - PayPhone API calls
- `src/seed/seed.service.ts` - cleans orders → carts → products → users
