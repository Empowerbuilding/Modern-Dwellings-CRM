# Website Activity Tracking

This guide explains how to add activity tracking to your websites to capture visitor behavior and connect it to CRM contacts.

## Quick Start

Add this script tag before `</body>` on your website:

```html
<script src="https://crm.yourdomain.com/tracking.js" data-site="showcase"></script>
```

Replace:
- `crm.yourdomain.com` with your CRM domain
- `showcase` with your site identifier

## How It Works

1. **Anonymous Tracking**: The script generates a unique visitor ID stored in localStorage
2. **Page Views**: Every page load is tracked automatically
3. **SPA Support**: Works with single-page apps (React, Next.js, etc.)
4. **Contact Linking**: When a visitor submits a form, their anonymous page views are linked to their contact record

## Installation

### Basic Installation

```html
<!DOCTYPE html>
<html>
<head>
  <title>Your Website</title>
</head>
<body>
  <!-- Your content -->

  <!-- Add before closing body tag -->
  <script src="https://crm.yourdomain.com/tracking.js" data-site="showcase"></script>
</body>
</html>
```

### With Debug Mode

Enable console logging for development:

```html
<script
  src="https://crm.yourdomain.com/tracking.js"
  data-site="showcase"
  data-debug="true"
></script>
```

## Configuration Options

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-site` | Yes | Site identifier: `showcase` |
| `data-debug` | No | Set to `"true"` to enable console logging |
| `data-endpoint` | No | Custom API endpoint (defaults to same origin as script) |

## JavaScript API

The script exposes a global `CRMTracking` object:

### Track Custom Events

```javascript
// Track a custom event
CRMTracking.trackEvent('form_submit', 'Submitted Contact Form', {
  form_name: 'contact',
  email: 'user@example.com'
});
```

### Track Additional Page Views

```javascript
// Manually track a page view (useful for SPAs)
CRMTracking.trackPageView();
```

### Get Visitor ID

```javascript
// Get the anonymous visitor ID to include in form submissions
const visitorId = CRMTracking.getVisitorId();
console.log(visitorId); // "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

## Connecting Form Submissions

To link anonymous page views to a contact, include the visitor ID when submitting lead forms:

### Example: Cost Calculator Form

```javascript
// When submitting your form
const formData = {
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  source: 'cost_calc',
  // Include the anonymous_id to link page views
  anonymous_id: CRMTracking.getVisitorId(),
  metadata: {
    estimated_cost: 150000,
    sqft: 2000
  }
};

fetch('https://crm.yourdomain.com/api/leads/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-webhook-api-key'
  },
  body: JSON.stringify(formData)
});
```

When the webhook receives the `anonymous_id`, it automatically:
1. Creates the contact and deal
2. Links all previous anonymous page views to the new contact
3. Creates a "form_submit" activity

## What Gets Tracked

### Automatic Tracking

- **Page Views**: URL, title, referrer, timestamp
- **Device Info**: Screen size, viewport, timezone, language
- **Navigation**: SPA route changes (pushState, popstate)

### Data Stored

Each activity includes:

```json
{
  "anonymous_id": "uuid-of-visitor",
  "activity_type": "page_view",
  "title": "Visited Cost Calculator",
  "metadata": {
    "site": "showcase",
    "page_url": "https://showcasebuilders.com/cost-calculator",
    "page_title": "Cost Calculator",
    "page_path": "/cost-calculator",
    "referrer": "https://google.com",
    "screen_width": 1920,
    "screen_height": 1080,
    "viewport_width": 1200,
    "viewport_height": 800,
    "timezone": "America/New_York",
    "language": "en-US",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Privacy & GDPR

- No cookies are used (localStorage only)
- IP addresses are stored but can be anonymized
- Visitor IDs are random UUIDs with no PII
- Data is stored in your own CRM database

For GDPR compliance, consider:
1. Adding tracking to your privacy policy
2. Implementing a cookie/tracking consent banner
3. Honoring Do Not Track browser settings (not implemented by default)

## Troubleshooting

### Script Not Loading

Check browser console for errors. Common issues:
- CORS errors: Ensure your CRM domain allows cross-origin requests
- 404 errors: Verify the script URL is correct

### Page Views Not Appearing

1. Enable debug mode: `data-debug="true"`
2. Check browser console for `[CRM Tracking]` logs
3. Verify the API endpoint is accessible

### Anonymous ID Not Persisting

- Check if localStorage is available (private browsing may disable it)
- Verify no scripts are clearing localStorage

## Rate Limiting

The tracking endpoint is rate-limited to 60 requests per minute per IP address. This prevents abuse while allowing normal user behavior.

## Site Identifiers

| Site | Identifier |
|------|------------|
| Showcase | `showcase` |

## API Reference

### POST /api/activities/track

Track an activity from external websites.

**Request:**
```json
{
  "anonymous_id": "string (required, 8-128 chars)",
  "activity_type": "page_view",
  "title": "Visited Home Page",
  "page_url": "https://example.com/",
  "metadata": {
    "site": "showcase",
    "page_title": "Home Page"
  }
}
```

**Response:**
```json
{
  "success": true,
  "activity_id": "uuid"
}
```

**Headers:**
- No authentication required
- CORS enabled for all origins
