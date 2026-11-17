import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express();
const PORT = 8000;
const DATABASE_NAME = 'studiospace-client';
const client = new MongoClient(process.env.MONGODB_URI);
const AUTH_BASE_URL = process.env.BETTER_AUTH_URL;
const authJwks = AUTH_BASE_URL
  ? createRemoteJWKSet(new URL('/api/auth/jwks', `${AUTH_BASE_URL}/`))
  : null;

app.use(express.json());
app.use(cors());


export async function connectToMongoDB() {
  await client.connect();
  console.log('Successfully connected to MongoDB.');
  return client;
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db(DATABASE_NAME);
const studiosCollection = db.collection('studios');
const bookingsCollection = db.collection('bookings');



const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidObjectId = (id) => ObjectId.isValid(id) && String(new ObjectId(id)) === id;

async function requireAuth(req, res, next) {
  const authorization = req.get('authorization') ?? '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).send({ message: 'A valid bearer token is required.' });
  if (!AUTH_BASE_URL || !authJwks) {
    return res.status(503).send({ message: 'Backend JWT verification is not configured.' });
  }

  try {
    const { payload } = await jwtVerify(token, authJwks, {
      issuer: AUTH_BASE_URL,
      audience: AUTH_BASE_URL,
    });
    const email = normalizeEmail(payload.email);
    if (typeof payload.sub !== 'string' || !validEmail(email)) {
      return res.status(401).send({ message: 'The bearer token does not identify a valid user.' });
    }

    req.authUser = {
      id: payload.sub,
      email,
      name: typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : email,
    };
    next();
  } catch {
    return res.status(401).send({ message: 'The bearer token is invalid or expired.' });
  }
}

function requireAuthForMine(req, res, next) {
  return req.query.mine === '1' ? requireAuth(req, res, next) : next();
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

function parseStudio(payload, { partial = false } = {}) {
  payload = {
    ...payload,
    title: payload.title ?? payload.name,
    hourlyRate: payload.hourlyRate ?? payload.price,
    overview: payload.overview ?? payload.description,
  };
  const fields = [
    'title',
    'studioSlug',
    'category',
    'hourlyRate',
    'securityDeposit',
    'maxCapacity',
    'location',
    'address',
    'imageUrl',
    'gallery',
    'amenities',
    'overview',
    'ownerEmail',
    'ownerName',
    'neighborhood',
    'size',
    'instant',
    'status',
  ];
  const studio = {};

  for (const field of fields) {
    if (payload[field] !== undefined) studio[field] = payload[field];
  }

  if (!partial) {
    for (const field of ['title', 'category', 'hourlyRate', 'maxCapacity', 'location', 'imageUrl', 'overview', 'ownerEmail', 'ownerName']) {
      if (studio[field] === undefined || studio[field] === '') {
        return { error: `${field} is required.` };
      }
    }
  }

  if (studio.ownerEmail !== undefined) {
    studio.ownerEmail = normalizeEmail(studio.ownerEmail);
    if (!validEmail(studio.ownerEmail)) return { error: 'ownerEmail must be a valid email address.' };
  }
  if (studio.hourlyRate !== undefined) {
    studio.hourlyRate = Number(studio.hourlyRate);
    if (!Number.isFinite(studio.hourlyRate) || studio.hourlyRate < 0) {
      return { error: 'hourlyRate must be a non-negative number.' };
    }
  }
  if (studio.securityDeposit !== undefined) {
    studio.securityDeposit = Number(studio.securityDeposit);
    if (!Number.isFinite(studio.securityDeposit) || studio.securityDeposit < 0) {
      return { error: 'securityDeposit must be a non-negative number.' };
    }
  }
  if (studio.maxCapacity !== undefined) {
    studio.maxCapacity = Number(studio.maxCapacity);
    if (!Number.isInteger(studio.maxCapacity) || studio.maxCapacity < 1) {
      return { error: 'maxCapacity must be a positive integer.' };
    }
  }
  if (studio.imageUrl !== undefined) {
    try {
      const imageUrl = new URL(studio.imageUrl);
      if (!['http:', 'https:'].includes(imageUrl.protocol)) throw new Error();
    } catch {
      return { error: 'imageUrl must be a valid HTTP or HTTPS URL.' };
    }
  }
  if (studio.gallery !== undefined && (!Array.isArray(studio.gallery) || studio.gallery.some((url) => typeof url !== 'string'))) {
    return { error: 'gallery must be an array of image URLs.' };
  }
  if (studio.amenities !== undefined && (!Array.isArray(studio.amenities) || studio.amenities.some((item) => typeof item !== 'string'))) {
    return { error: 'amenities must be an array of strings.' };
  }
  if (studio.location !== undefined && typeof studio.location !== 'string') {
    return { error: 'location must be a string.' };
  }
  if (studio.address !== undefined && typeof studio.address !== 'string') {
    return { error: 'address must be a string.' };
  }
  if (studio.overview !== undefined && typeof studio.overview !== 'string') {
    return { error: 'overview must be a string.' };
  }
  if (studio.ownerName !== undefined && typeof studio.ownerName !== 'string') {
    return { error: 'ownerName must be a string.' };
  }
  if (studio.studioSlug !== undefined && typeof studio.studioSlug !== 'string') {
    return { error: 'studioSlug must be a string.' };
  }
  if (studio.status !== undefined && !['Live', 'Paused'].includes(studio.status)) {
    return { error: 'status must be Live or Paused.' };
  }
  if (studio.instant !== undefined && typeof studio.instant !== 'boolean') {
    return { error: 'instant must be a boolean.' };
  }

  return { studio };
}

app.get('/', (req, res) => {
  res.send({ message: 'Server is running' });
});

app.post(
  '/upload-image',
  requireAuth,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], limit: '10mb' }),
  async (req, res) => {
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) return res.status(503).send({ message: 'Image uploads are not configured.' });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).send({ message: 'Send an image as the raw request body with an image content type.' });
    }

    const form = new URLSearchParams({ image: req.body.toString('base64') });
    const uploadResponse = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const result = await uploadResponse.json();
    if (!uploadResponse.ok || !result.success || !result.data?.url) {
      console.error('imgbb upload failed:', result.error?.message ?? uploadResponse.statusText);
      return res.status(502).send({ message: 'The image hosting service could not upload this image.' });
    }
    res.status(201).send({ url: result.data.url, displayUrl: result.data.display_url });
  },
);

app.get('/studios', requireAuthForMine, async (req, res) => {
  const filter = {};
  if (typeof req.query.category === 'string') filter.category = req.query.category;
  if (req.query.mine === '1') filter.ownerEmail = req.authUser.email;

  const studios = await studiosCollection
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  res.send({ studios });
});

async function createStudio(req, res) {
  const { studio, error } = parseStudio({
    ...(req.body ?? {}),
    ownerEmail: req.authUser.email,
    ownerName: req.authUser.name,
  });
  if (error) return res.status(400).send({ message: error });

  const now = new Date();
  const id = new ObjectId();
  const newStudio = {
    ...studio,
    _id: id,
    slug: studio.studioSlug || `${slugify(studio.title) || 'studio'}-${id.toString().slice(-6)}`,
    securityDeposit: studio.securityDeposit ?? 0,
    gallery: studio.gallery ?? [],
    amenities: studio.amenities ?? [],
    status: studio.status ?? 'Live',
    rating: 0,
    reviewCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await studiosCollection.insertOne(newStudio);
  res.status(201).send(newStudio);
}

app.post('/studios', requireAuth, createStudio);
app.post('/add-studio', requireAuth, createStudio);

app.get('/studios/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).send({ message: 'Invalid studio id.' });
  const studio = await studiosCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!studio) return res.status(404).send({ message: 'Studio not found.' });
  res.send(studio);
});

app.get('/my-listings', requireAuth, async (req, res) => {
  const studios = await studiosCollection.find({ ownerEmail: req.authUser.email }).sort({ createdAt: -1 }).toArray();
  res.send(studios);
});

async function updateStudio(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(400).send({ message: 'Invalid studio id.' });

  const { studio, error } = parseStudio(req.body ?? {}, { partial: true });
  if (error) return res.status(400).send({ message: error });
  delete studio.ownerEmail;
  delete studio.ownerName;
  if (Object.keys(studio).length === 0) return res.status(400).send({ message: 'At least one editable field is required.' });
  studio.updatedAt = new Date();

  const result = await studiosCollection.updateOne(
    { _id: new ObjectId(req.params.id), ownerEmail: req.authUser.email },
    { $set: studio },
  );
  if (result.matchedCount === 0) return res.status(404).send({ message: 'Studio not found for this owner.' });
  res.send({ message: 'Studio updated successfully.' });
}

app.patch('/studios/:id', requireAuth, updateStudio);
app.put('/studios/:id', requireAuth, updateStudio);

app.delete('/studios/:id', requireAuth, async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).send({ message: 'Invalid studio id.' });

  const result = await studiosCollection.deleteOne({ _id: new ObjectId(req.params.id), ownerEmail: req.authUser.email });
  if (result.deletedCount === 0) return res.status(404).send({ message: 'Studio not found for this owner.' });
  res.send({ message: 'Studio deleted successfully.' });
});

app.post('/bookings', requireAuth, async (req, res) => {
  const { studioId, studioSlug } = req.body ?? {};
  const email = req.authUser.email;
  const userName = req.authUser.name;
  const normalizedStudioId = typeof studioId === 'string' ? studioId.trim() : '';
  const normalizedStudioSlug = typeof studioSlug === 'string' && studioSlug.trim()
    ? studioSlug.trim()
    : (!isValidObjectId(normalizedStudioId) ? normalizedStudioId : '');
  if (!isValidObjectId(normalizedStudioId) && !normalizedStudioSlug) {
    return res.status(400).send({ message: 'A studioId or studioSlug is required.' });
  }
  if (!validEmail(email)) return res.status(400).send({ message: 'A valid userEmail is required.' });
  if (typeof userName !== 'string' || !userName.trim()) return res.status(400).send({ message: 'userName is required.' });

  let studio = isValidObjectId(normalizedStudioId)
    ? await studiosCollection.findOne({ _id: new ObjectId(normalizedStudioId) })
    : null;
  if (!studio && normalizedStudioSlug) {
    studio = await studiosCollection.findOne({
      $or: [{ studioSlug: normalizedStudioSlug }, { slug: normalizedStudioSlug }],
    });
  }
  if (!studio) return res.status(404).send({ message: 'Studio not found.' });

  const booking = {
    studioId: studio._id,
    studioTitle: studio.title,
    studioImageUrl: studio.imageUrl,
    ownerEmail: studio.ownerEmail,
    userEmail: email,
    userName: userName.trim(),
    bookingDate: req.body.bookingDate ?? req.body.date ?? null,
    startTime: req.body.startTime ?? null,
    durationHours: Number.isFinite(Number(req.body.durationHours)) ? Number(req.body.durationHours) : null,
    totalPrice: Number.isFinite(Number(req.body.totalPrice)) ? Number(req.body.totalPrice) : null,
    status: 'Pending',
    createdAt: new Date(),
  };
  const result = await bookingsCollection.insertOne(booking);
  res.status(201).send({ ...booking, _id: result.insertedId });
});

app.get('/bookings', requireAuth, async (req, res) => {
  const bookings = await bookingsCollection.find({ userEmail: req.authUser.email }).sort({ createdAt: -1 }).toArray();
  res.send({ bookings });
});

app.get('/my-bookings', requireAuth, async (req, res) => {
  const bookings = await bookingsCollection.find({ userEmail: req.authUser.email }).sort({ createdAt: -1 }).toArray();
  res.send({ bookings });
});

app.patch('/bookings/:id/cancel', requireAuth, async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).send({ message: 'Invalid booking id.' });

  const result = await bookingsCollection.updateOne(
    { _id: new ObjectId(req.params.id), userEmail: req.authUser.email, status: 'Pending' },
    { $set: { status: 'Cancelled', updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) {
    return res.status(404).send({ message: 'Pending booking not found for this user.' });
  }
  res.send({ message: 'Booking cancelled successfully.' });
});




app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
