# StudioSpaceServer

Express and MongoDB API for StudioSpace.

## Setup

Create a `.env` file with:

```text
MONGODB_URI=your-mongodb-connection-string
MONGODB_DATABASE=studiospace-client
IMGBB_API_KEY=your-imgbb-api-key
PORT=8000
```

Install dependencies with `npm install`, then start with `npm start`. The local API base URL is `http://localhost:8000` (or the configured `PORT`). `npm test` performs a JavaScript syntax check.

## API

All endpoints are available with or without the `/api` prefix (for example, `GET /studios` and `GET /api/studios`). All endpoints use JSON except `POST /upload-image`, which accepts raw JPEG, PNG, WebP, or GIF image bytes and returns the hosted URL. It proxies uploads to imgbb using `IMGBB_API_KEY`; configure that key to enable uploads. Save the returned URL as `imageUrl` (additional carousel URLs can be sent in `gallery`). Unknown API routes return a JSON 404 response.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/studios` | List studios; optional `?category=` filter |
| POST | `/upload-image` | Upload raw image bytes to imgbb |
| POST | `/studios` | Create a studio |
| POST | `/add-studio` | Alias for creating a studio |
| GET | `/studios/:id` | Get a studio |
| GET | `/my-listings?email=` | List studios belonging to an owner |
| PATCH / PUT | `/studios/:id` | Update a studio owned by `ownerEmail` |
| DELETE | `/studios/:id?email=` | Delete a studio owned by the supplied email |
| POST | `/bookings` | Create a booking with `Pending` status |
| GET | `/my-bookings?email=` | List bookings for a user |
| PATCH | `/bookings/:id/cancel` | Cancel a user's pending booking |

If the response is an HTML page, check that the client is calling the backend host and port (`http://localhost:8000` locally), not the frontend development server, and that it uses one of the routes above. A JSON `API route not found` response includes the method and path that the backend received.

Studio creation requires `title`, `category`, `hourlyRate`, `maxCapacity`, `location`, `imageUrl`, `overview`, `ownerEmail`, and `ownerName`. `securityDeposit`, `gallery`, and `amenities` are optional. Editing/deleting/listing routes accept the owner email in the query string or JSON body as applicable.

Booking creation requires `userEmail` and `userName`, plus either a MongoDB `studioId` or a `studioSlug`. The `studioSlug` can also be supplied as `studioId` for compatibility with clients that use the slug there. Bookings store the resolved MongoDB studio ID. Optional reservation fields are `bookingDate` (or `date`), `startTime`, `durationHours`, and `totalPrice`.

## Authentication note

Email parameters are used to scope owner and customer records, but they are not authentication. Before exposing this API publicly, verify the caller's identity with server-validated authentication (for example, Firebase Admin token verification) and derive the email from the verified identity rather than trusting client-supplied email values. Configure CORS to allow only the production frontend origin as appropriate.
