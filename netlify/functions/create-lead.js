// netlify/functions/create-lead.js
//
// Receives a lead/enquiry from an external site (e.g. the Aangan real estate
// site) and creates a Lead row using the existing Prisma schema.
//
// SETUP CHECKLIST:
// 1. Put this file at:  netlify/functions/create-lead.js  in your CRM repo.
// 2. Make sure @prisma/client is a dependency in your CRM's package.json
//    (it already is, since the CRM itself uses Prisma).
// 3. Make sure `prisma generate` runs during your Netlify build, e.g. in
//    package.json:  "build": "prisma generate && vite build"
// 4. Add/merge this into your netlify.toml:
//
//      [functions]
//        external_node_modules = ["@prisma/client", ".prisma/client"]
//        node_bundler = "esbuild"
//
// 5. DATABASE_URL and DIRECT_URL must already be set as environment
//    variables in Netlify (Site settings > Environment variables) — since
//    your CRM already runs on Postgres, they likely already are.
// 6. Replace ALLOWED_ORIGIN below with your real estate site's actual
//    Netlify URL once you have it, e.g. "https://aangan-estates.netlify.app"
//    (using "*" works for testing but is not recommended long-term).
 
const { PrismaClient } = require('@prisma/client');
 
const ALLOWED_ORIGIN = '*'; // TODO: replace with your real estate site's URL
 
// Reuse one Prisma client across warm serverless invocations.
let prisma;
if (!global.__aanganPrisma) {
  global.__aanganPrisma = new PrismaClient();
}
prisma = global.__aanganPrisma;
 
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
 
function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
 
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }
 
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }
 
  const firstName = (body.fname || body.firstName || '').trim();
  const lastName = (body.lname || body.lastName || '').trim();
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim();
 
  if (!firstName) {
    return json(400, { error: 'First name is required' });
  }
  if (!email && !phone) {
    return json(400, { error: 'Either email or phone is required' });
  }
 
  try {
    // Make sure the "public_form" lead source exists (self-healing: creates
    // it once if this is the very first public submission).
    const source = await prisma.leadSource.upsert({
      where: { key: 'public_form' },
      update: {},
      create: { key: 'public_form', label: 'Website form', color: '#8C2F39' },
    });
 
    // Find the default status. We don't invent one here on purpose — if no
    // status is marked default yet, that's a real CRM setup step.
    let defaultStatus = await prisma.leadStatus.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (!defaultStatus) {
      defaultStatus = await prisma.leadStatus.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    }
    if (!defaultStatus) {
      return json(500, {
        error: 'No Lead Status is configured in the CRM yet. Add at least one status (and mark one as default) before accepting public leads.',
      });
    }
 
    // Try to match the enquired-about property type to an existing
    // PropertyType row; if there's no match, keep the raw label in notes
    // instead of losing it.
    let propertyTypeKey = null;
    const propertyTypeLabel = (body.propertyTypeLabel || '').trim();
    if (propertyTypeLabel) {
      const match = await prisma.propertyType.findFirst({
        where: { isActive: true, label: { equals: propertyTypeLabel, mode: 'insensitive' } },
      });
      if (match) propertyTypeKey = match.key;
    }
 
    const extraNotes = [];
    if (propertyTypeLabel && !propertyTypeKey) {
      extraNotes.push(`Interested property type (no CRM match): ${propertyTypeLabel}`);
    }
    if (body.interestedLocation) {
      extraNotes.push(`Interested location: ${body.interestedLocation}`);
    }
 
    const ipAddress =
      event.headers['x-nf-client-connection-ip'] ||
      (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      null;
    const userAgent = event.headers['user-agent'] || null;
 
    const lead = await prisma.lead.create({
      data: {
        firstName,
        lastName: lastName || null,
        email: email || null,
        phone: phone || null,
        company: (body.company || '').trim() || null,
        city: (body.city || '').trim() || null,
        state: (body.stateRegion || body.state || '').trim() || null,
        country: (body.country || '').trim() || null,
        postalCode: (body.postal || body.postalCode || '').trim() || null,
        message: (body.message || '').trim() || null,
        notes: extraNotes.length ? extraNotes.join('\n') : null,
        consent: !!body.consent,
        ipAddress,
        userAgent,
        sourceKey: source.key,
        statusKey: defaultStatus.key,
        propertyTypeKey,
        priority: 'MEDIUM',
      },
    });
 
    return json(201, { ok: true, leadId: lead.id });
  } catch (err) {
    console.error('create-lead error:', err);
    return json(500, { error: 'Could not save the lead. Check function logs for details.' });
  }
};