import {Type} from '@sinclair/typebox'

export const Address = Type.Object({line1: Type.String(), line2: Type.Optional(Type.String()), city: Type.String(), postalCode: Type.String(), country: Type.String()});
