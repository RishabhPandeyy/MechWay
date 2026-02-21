# TODO: Add Vehicle Number and Color Fields + Fix Pricing

## Frontend Changes (mechanic.html)
- [x] Add Vehicle Number input field
- [x] Add Vehicle Color dropdown field
- [x] Update JavaScript to include new fields in data object
- [x] Update URL parameters to pass vehicle number and color
- [x] Fix pricing: ₹99 for bikes, ₹199 for cars (General Checkup service)

## Backend Changes (server/server.js)
- [x] Add vehicleNumber field to BookingSchema
- [x] Add vehicleColor field to BookingSchema
- [x] Add servicePrice field to BookingSchema
- [x] Update /api/book endpoint to handle new fields
- [x] Add vehicleNumber and vehicleColor to PaymentSchema

## Frontend Updates (payment.html)
- [x] Add vehicle number display in service details section
- [x] Add vehicle color display in service details section
- [x] Update pricing logic to use URL parameter
- [x] Update form submission to include new fields

## Completion
- [x] All changes implemented


