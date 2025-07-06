# Farcaster Indexer API

A high-performance REST API for accessing indexed Farcaster data with authentication, caching, and comprehensive admin tools.

## Features

- **Public API**: Access user profiles, feeds, casts, and trending content
- **Admin API**: Manage targets, client monitoring, and job queues
- **JWT Authentication**: Secure admin access with HTTP-only cookies
- **Caching**: Built-in response caching for improved performance
- **Validation**: Comprehensive request validation and error handling
- **Monitoring**: Health checks and system statistics

## Quick Start

### Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Run tests
bun run test

# Build for production
bun run build
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgres://postgres:password@localhost:5432/postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication
JWT_SECRET=your-secret-key-here-minimum-32-characters
ADMIN_PASSWORD=admin-password-123

# Optional: Neynar API key for hub fallback
NEYNAR_API_KEY=your-neynar-api-key
```

## API Reference

### Public Endpoints

All public endpoints are cached for 5 minutes and support pagination.

#### Get User Profile

```http
GET /api/v1/users/:fid
```

Returns user profile with statistics.

**Response:**

```json
{
  "user": {
    "fid": 1,
    "username": "dwr",
    "displayName": "Dan Romero",
    "bio": "Co-founder of Farcaster",
    "pfpUrl": "https://...",
    "custodyAddress": "0x...",
    "syncedAt": "2025-07-04T10:00:00Z",
    "stats": {
      "casts": 1234,
      "followers": 5678,
      "following": 123
    }
  }
}
```

#### Get Cast by Hash

```http
GET /api/v1/casts/:hash
```

Returns cast details with engagement statistics.

**Response:**

```json
{
  "cast": {
    "hash": "0x...",
    "fid": 1,
    "text": "Hello Farcaster!",
    "timestamp": "2025-07-04T10:00:00Z",
    "parentHash": null,
    "user": {
      "fid": 1,
      "username": "dwr"
    },
    "stats": {
      "likes": 42,
      "recasts": 12,
      "replies": 8
    }
  }
}
```

#### Get User Feed

```http
GET /api/v1/feed/:fid?limit=50&offset=0
```

Returns chronological feed of casts from users the FID follows.

**Query Parameters:**

- `limit` (optional): Number of items to return (max 100, default 50)
- `offset` (optional): Number of items to skip (default 0)

#### Get User's Casts

```http
GET /api/v1/users/:fid/casts?limit=50&offset=0
```

Returns paginated list of casts by the user.

#### Get User's Followers

```http
GET /api/v1/users/:fid/followers?limit=50&offset=0
```

Returns paginated list of users following the FID.

#### Get User's Following

```http
GET /api/v1/users/:fid/following?limit=50&offset=0
```

Returns paginated list of users the FID follows.

#### Get Trending Casts

```http
GET /api/v1/trending?limit=50&offset=0
```

Returns casts with the most reactions in the last 24 hours.

### Authentication

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "password": "admin-password-123"
}
```

Sets an HTTP-only cookie with JWT token valid for 24 hours.

#### Logout

```http
POST /api/auth/logout
```

Clears the authentication cookie.

#### Check Status

```http
GET /api/auth/status
```

Returns authentication status and user info.

### Admin Endpoints

All admin endpoints require authentication via JWT cookie.

#### List Targets

```http
GET /api/admin/targets?limit=50&offset=0&search=&is_root=&sort_by=added_at&sort_order=desc
```

Returns paginated list of indexed targets with filtering and sorting.

**Query Parameters:**

- `search`: Filter by FID (partial match)
- `is_root`: Filter by root status (true/false)
- `sort_by`: Sort field (fid, added_at)
- `sort_order`: Sort direction (asc, desc)

#### Add Target

```http
POST /api/admin/targets
Content-Type: application/json

{
  "fid": 12345,
  "isRoot": false
}
```

Adds a new target for indexing.

#### Update Target

```http
PUT /api/admin/targets/:fid
Content-Type: application/json

{
  "isRoot": true
}
```

Updates target properties.

#### Remove Target

```http
DELETE /api/admin/targets/:fid
```

Removes target from indexing.

#### Get Target Statistics

```http
GET /api/admin/targets/:fid/stats
```

Returns comprehensive statistics for a target.

#### Trigger Target Backfill

```http
POST /api/admin/targets/:fid/backfill
```

Queues a backfill job for the specific target.

#### List Client Targets

```http
GET /api/admin/client-targets?limit=50&offset=0
```

Returns paginated list of client FIDs being monitored.

#### Add Client Target

```http
POST /api/admin/client-targets
Content-Type: application/json

{
  "clientFid": 67890
}
```

Adds a new client FID to monitor for root target discovery.

#### Remove Client Target

```http
DELETE /api/admin/client-targets/:fid
```

Removes client FID from monitoring.

#### Get Job Status

```http
GET /api/admin/jobs
```

Returns job queue statistics and status.

#### Trigger Full Backfill

```http
POST /api/admin/jobs/backfill
```

Queues backfill jobs for all unsynced targets.

#### Get System Statistics

```http
GET /api/admin/stats
```

Returns comprehensive system statistics.

#### Get Analytics Dashboard Data

```http
GET /api/admin/analytics?timeRange=30d
```

Returns comprehensive analytics data for the dashboard including overview metrics, growth statistics, top targets, and recent activity.

**Query Parameters:**

- `timeRange` (optional): Time range for analytics (7d, 30d, 90d, default: 30d)

**Response:**

```json
{
  "overview": {
    "totalTargets": 1344,
    "totalCasts": 887977,
    "totalReactions": 868292,
    "totalLinks": 197275,
    "avgCastsPerTarget": 660.7,
    "avgReactionsPerCast": 0.98
  },
  "growth": {
    "newTargetsToday": 0,
    "newTargetsThisWeek": 12,
    "newTargetsThisMonth": 45,
    "castsToday": 156,
    "castsThisWeek": 1234,
    "castsThisMonth": 5678
  },
  "topTargets": [
    {
      "fid": 5708,
      "displayName": "User 5708",
      "username": "user5708",
      "castCount": 20,
      "reactionCount": 3,
      "followerCount": 166
    }
  ],
  "recentActivity": [
    {
      "date": "2025-07-05",
      "newTargets": 1,
      "totalCasts": 7,
      "totalReactions": 61
    }
  ],
  "timestamp": "2025-07-06T12:55:20.754Z"
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "message": "Additional details (development only)"
}
```

**HTTP Status Codes:**

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (authentication required/failed)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `500` - Internal Server Error

## Rate Limiting

- Public endpoints: No rate limiting (cached responses)
- Auth endpoints: Basic rate limiting by IP
- Admin endpoints: Protected by authentication

## Performance

- **Response Caching**: 5-minute cache for public endpoints
- **Database Optimization**: Indexed queries with pagination
- **Compression**: Gzip compression for all responses
- **Security Headers**: Comprehensive security headers
- **Connection Pooling**: Efficient database connections

## Security

- **JWT Authentication**: Secure token-based auth with 24-hour expiry
- **HTTP-Only Cookies**: Prevents XSS attacks
- **CORS Configuration**: Restricts cross-origin requests
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries via Drizzle ORM
- **Rate Limiting**: Protection against abuse

## Monitoring

### Health Check

```http
GET /health
```

Returns service health status:

```json
{
  "status": "healthy",
  "timestamp": "2025-07-04T10:00:00Z",
  "service": "farcaster-indexer-api"
}
```

### Metrics

Admin endpoints provide detailed metrics:

- Target counts and sync status
- Data volume (casts, users, reactions, links)
- Job queue statistics
- System performance metrics

## Development

### Architecture

- **Framework**: Hono (lightweight, fast)
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Redis for performance
- **Authentication**: JWT with HTTP-only cookies
- **Testing**: Vitest with comprehensive test coverage

### File Structure

```
src/
├── server.ts          # Main server setup
├── middleware/
│   └── auth.ts        # JWT authentication
├── routes/
│   ├── auth.ts        # Authentication endpoints
│   ├── public.ts      # Public API endpoints
│   └── admin.ts       # Admin API endpoints
└── *.test.ts          # Test files
```

### Testing

```bash
# Run all tests
bun run test

# Run with coverage
bun run test:coverage

# Run in watch mode
bun run test:watch
```

Test coverage includes:

- Authentication flows
- All API endpoints
- Error handling
- Security validation
- Database operations

## Deployment

### Production Build

```bash
bun run build
bun run start
```

### Docker

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
EXPOSE 3001
CMD ["bun", "run", "start"]
```

### Environment

Ensure all environment variables are set in production:

- Strong JWT secret (minimum 32 characters)
- Secure admin password
- Database connection string
- Redis connection details

## Contributing

1. Follow TypeScript best practices
2. Add tests for new endpoints
3. Update documentation
4. Ensure security considerations
5. Maintain consistent error handling
