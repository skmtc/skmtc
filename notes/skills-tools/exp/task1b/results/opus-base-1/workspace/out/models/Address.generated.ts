import {Schema} from 'effect'

export const Address = Schema.Struct({
  line1: Schema.String,
  line2: Schema.optional(Schema.String),
  city: Schema.String,
  postalCode: Schema.String,
  country: Schema.String
});
