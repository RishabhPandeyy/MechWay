# MechWay

Static frontend with an Express and MongoDB backend.

## Local development

Install dependencies with `npm ci`, configure `server/.env`, then run `npm start`.
The application serves `public/` at http://localhost:4000.

## Deployment

- **Hostinger frontend:** upload the contents of `public/` to `public_html/`, including `.htaccess`.
- **Render backend:** use the repository root, build with `npm ci --omit=dev`, and start with `npm start`.
- Configure backend environment variables in Render; environment files and local customer data are excluded from Git.
- Deploy backend changes before frontend changes. The frontend uses `https://newonwheels.onrender.com` for production API calls.

Quick restoration enquiries are saved in `restoration_quotes`; detailed restoration requests are saved in `restoration_requests`.
Detailed restoration submissions require six images: government ID, RC, front, rear, left and right.

## Validation

Run `npm test`, `npm run check:frontend`, and `npm run check:seo`.
SEO metadata is maintained in `scripts/seo-config.js` and generated with `npm run seo:update`.
