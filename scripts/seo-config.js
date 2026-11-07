const origin = 'https://www.mechway.in';
const pages = [
  { file: 'index.html', path: '/', title: '24/7 Mobile Car & Bike Repair in Prayagraj | MechWay', description: 'Need a fast mobile mechanic in Prayagraj? MechWay offers 24/7 car & bike repair at your location. NO SIGNUP REQUIRED - Instant booking!', kind: 'home' },
  { file: 'pages/mechanic.html', title: 'Book a Mechanic Online in Prayagraj | MechWay', description: 'Request a doorstep bike or car mechanic in Prayagraj. Choose your service, location and immediate or scheduled visit. See visiting charges before confirmation.', kind: 'repair' },
  { file: 'pages/service.html', title: 'Doorstep Bike & Car Repair in Prayagraj | MechWay', description: 'Explore MechWay bike and car repair services in Prayagraj, including punctures, battery assistance, brake checks and diagnostics. Book a mechanic at your location.', kind: 'repair' },
  { file: 'pages/pricing.html', title: '7-Day Service Warranty for Bike & Car Repairs | MechWay', description: 'Learn how MechWay\'s 7-day service warranty works for bike and car repairs in Prayagraj. Pay the service bill through your MechWay booking link. Parts are excluded.', kind: 'page' },
  { file: 'pages/startrestoration.html', title: 'Bike & Car Restoration and Customization Across India | MechWay', description: 'Request bike or car restoration, customization and modification from anywhere in India. Share photos and your budget; MechWay confirms the estimate and pickup options.', kind: 'restoration' },
  { file: 'pages/restore.html', title: 'Bike Restoration & Customization in India | MechWay', description: 'Explore bike restoration and customization across India with MechWay: classic motorcycle rebuilds, custom paint, chrome and seats. Request a project estimate.', kind: 'bike-restoration' },
  { file: 'pages/about.html', title: 'About MechWay | Doorstep Mechanics in Prayagraj', description: 'Meet MechWay, a doorstep bike and car mechanic service in Prayagraj. Learn about our repair approach, mechanic network and customer support.', kind: 'about' },
  { file: 'pages/why-us.html', title: 'Why Choose MechWay for Vehicle Repairs in Prayagraj?', description: 'Explore MechWay doorstep service, upfront visiting charges and customer-approved repairs. Book bike or car assistance in Prayagraj without an account.', kind: 'page' },
  { file: 'pages/contact.html', title: 'Contact MechWay | Mechanic & Restoration Help in Prayagraj', description: 'Contact MechWay in Prayagraj for bike and car repairs, roadside assistance or restoration enquiries. Call +91 97945 75236 or submit your request online.', kind: 'contact' },
  { file: 'pages/shop.html', title: 'Car & Bike Parts, Oils and Essentials | MechWay Prayagraj', description: 'Browse car and bike essentials with MechWay in Prayagraj: engine oils, coolant, chain lubricants, filters and puncture kits. Enquire about availability and prices.', kind: 'shop' },
  { file: 'pages/blog-battery-signs.html', title: '5 Signs of a Weak Car Battery | MechWay Vehicle Care', description: 'Learn the signs of a weak car battery, including slow starting, dim lights and electrical issues. Find out when to request a mechanic in Prayagraj.', kind: 'article' },
  { file: 'pages/blog-oil-change.html', title: 'When to Change Car Engine Oil | MechWay Vehicle Care', description: 'Understand car engine oil changes, oil types and demanding driving conditions. Follow your vehicle manual and book mechanic assistance in Prayagraj.', kind: 'article' },
  { file: 'pages/mech-signup.html', title: 'Mechanic Registration | Join MechWay', description: 'Apply to join MechWay as a mechanic partner. Submit your personal, service-area and payment details for registration.', index: false },
  { file: 'pages/mech-login.html', title: 'Mechanic Login & Password Help | MechWay', description: 'Access your MechWay mechanic account or submit a password-help request to our support team.', index: false },
  { file: 'pages/mech-dashboard.html', title: 'Mechanic Dashboard | MechWay', description: 'Manage assigned jobs, workslips, earnings and payouts in your MechWay mechanic account.', index: false },
  { file: 'pages/login.html', title: 'Account Login | MechWay', description: 'Access your MechWay account.', index: false },
  { file: 'pages/signup.html', title: 'Partner Signup | MechWay', description: 'Register your MechWay partner account.', index: false },
  { file: 'pages/auth.html', title: 'Account Access | MechWay', description: 'Sign in to your MechWay account or manage account access.', index: false },
  { file: 'pages/reset-password.html', title: 'Reset Your Password | MechWay', description: 'Set a new password using your MechWay account reset link.', index: false },
  { file: 'pages/book.html', title: 'Ride Booking | MechWay', description: 'Enter pickup and destination details in the MechWay ride-booking form.', index: false },
  { file: 'pages/payment.html', title: 'Service Payment | MechWay', description: 'Complete the payment for your MechWay service request.', index: false },
  { file: 'pages/payment-with-db.html', title: 'Booking Payment | MechWay', description: 'Complete payment for your MechWay booking.', index: false },
  { file: 'pages/booking-confirmed.html', title: 'Booking Confirmation | MechWay', description: 'View the confirmation and next steps for your MechWay booking.', index: false },
  { file: 'pages/mechanic-details.html', title: 'Your Assigned Mechanic | MechWay', description: 'View the mechanic contact information and service details for your MechWay booking.', index: false },
  { file: 'server/admin.html', title: 'Admin Panel | MechWay', description: 'MechWay administration and service management.', index: false },
  { file: 'server/restoration_admin.html', title: 'Restoration Admin | MechWay', description: 'Manage MechWay restoration requests.', index: false }
].map(page => ({ ...page, path: page.path || `/${page.file}`, index: page.index !== false }));

module.exports = { origin, pages };
