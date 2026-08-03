import {Schema} from 'effect'

export const Category: Schema.Schema<any> = Schema.Struct({id: Schema.String, name: Schema.String, children: Schema.optional(Schema.Array(Schema.suspend((): Schema.Schema<any> => Category)))});
