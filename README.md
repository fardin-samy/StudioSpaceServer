# StudioSpaceServer

Express and MongoDB API for StudioSpace.

## Setup

Create a `.env` file with:

```text
MONGODB_URI=your-mongodb-connection-string
MONGODB_DATABASE=studiospace-client
IMGBB_API_KEY=your-imgbb-api-key
PORT=8000
BETTER_AUTH_URL=http://localhost:3000
```

Install dependencies with `npm install`, then start with `npm start`. The local API base URL is `http://localhost:8000` (or the configured `PORT`). Set `BETTER_AUTH_URL` to the exact base URL configured by the frontend Better Auth server; the backend verifies bearer JWTs using `${BETTER_AUTH_URL}/api/auth/jwks` and validates issuer and audience against that URL. `npm test` performs a JavaScript syntax check.

## API

All endpoints are available with or without the `/api` prefix (for example, `GET /studios` and `GET /api/studios`). All endpoints use JSON except `POST /upload-image`, which accepts raw JPEG, PNG, WebP, or GIF image bytes and returns the hosted URL. It proxies uploads to imgbb using `IMGBB_API_KEY`; configure that key to enable uploads. Save the returned URL as `imageUrl` (additional carousel URLs can be sent in `gallery`). Unknown API routes return a JSON 404 response.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/studios` | List studios; optional `?category=` filter |
| POST | `/upload-image` | Upload raw image bytes to imgbb (JWT required) |
| POST | `/studios` | Create a studio (JWT required) |
| POST | `/add-studio` | Alias for creating a studio (JWT required) |
| GET | `/studios/:id` | Get a studio |
| GET | `/studios?mine=1` | List the authenticated user's studios (JWT required) |
| GET | `/my-listings` | List the authenticated user's studios (JWT required) |
| PATCH / PUT | `/studios/:id` | Update the authenticated owner's studio (JWT required) |
| DELETE | `/studios/:id` | Delete the authenticated owner's studio (JWT required) |
| POST | `/bookings` | Create a booking for the authenticated user (JWT required) |
| GET | `/bookings` or `/my-bookings` | List the authenticated user's bookings (JWT required) |
| PATCH | `/bookings/:id/cancel` | Cancel the authenticated user's pending booking (JWT required) |

If the response is an HTML page, check that the client is calling the backend host and port (`http://localhost:8000` locally), not the frontend development server, and that it uses one of the routes above. A JSON `API route not found` response includes the method and path that the backend received.

Send authenticated requests with `Authorization: Bearer <JWT>`. The frontend obtains this short-lived JWT from Better Auth's JWT plugin; do not copy a session cookie/token into source code or send user identity fields as a substitute for verification. The backend derives the user ID, email, and name from the verified JWT. Public studio browsing does not require a token.

Studio creation requires `category`, `maxCapacity`, `location`, and an image URL, along with a title (`title` or `name`), hourly rate (`hourlyRate` or `price`), and description (`overview` or `description`). Ownership fields are set from the verified token. Booking creation requires either a MongoDB `studioId` or a `studioSlug`; bookings store the resolved MongoDB studio ID and verified user identity. Optional reservation fields are `bookingDate` (or `date`), `startTime`, `durationHours`, and `totalPrice`.

## Authentication note

Configure CORS to allow only the production frontend origin as appropriate. Never place the Better Auth signing secret or a user's bearer token in `NEXT_PUBLIC_*` variables, source files, or logs.
