// import { Customer } from '@/lib/models/customer'
// import { Order } from '@/lib/models/order'
// import { Payment } from '@/lib/models/payment'
// import { Product } from '@/lib/models/product'
import { AccessorKeyColumnDefBase, IdIdentifier } from '@tanstack/react-table'

type ColumnsType<Model extends HasId> = (AccessorKeyColumnDefBase<Model, string> &
  Partial<IdIdentifier<Model, string>>)[]

type ConfigItem = {
  title: string
  description: string
  columns: <Model extends HasId>(columns: ColumnsType<Model>) => ColumnsType<Model>
}

type HasId = {
  id: string
}

const tableConfig: Record<string, ConfigItem> = {
  '/customers': {
    title: 'Customers',
    description: 'View and manage your customers',
    columns: <Model extends HasId>(columns: ColumnsType<Model>) => columns
  }
}

export const configureTable = (key: string) => {
  return (
    tableConfig[key] ?? {
      title: 'ADD TITLE',
      description: 'ADD DESCRIPTION',
      columns: <Model extends HasId>(columns: ColumnsType<Model>) => columns
    }
  )
}

// type OptionConfigMap = {
//   Customer: Customer
//   Order: Order
//   Product: Product
//   Payment: Payment
// }

type Option = {
  label: string
  value: string
}

// type OptionConfig = {
//   [Property in keyof OptionConfigMap]: (value: OptionConfigMap[Property]) => Option
// }

// const optionConfig: OptionConfig = {
//   Customer: (customer: Customer) => ({
//     label: `${customer.firstName} ${customer.lastName}`,
//     value: customer.id
//   }),
//   Order: (order: Order) => ({
//     label: `${order.id}`,
//     value: order.id
//   }),
//   Product: (product: Product) => ({
//     label: `${product.name}`,
//     value: product.id
//   }),
//   Payment: (payment: Payment) => ({
//     label: `${payment.createdAt} ${payment.amount} ${payment.email}`,
//     value: payment.id
//   })
// }

// type ConfigureOptionArg<Key extends keyof OptionConfigMap, Model extends OptionConfigMap[Key]> = {
//   key: Key
//   value: Model
// }

// export const configureOption = <
//   Key extends keyof OptionConfigMap,
//   Model extends OptionConfigMap[Key]
// >(
//   args: ConfigureOptionArg<Key, Model>
// ) => {
//   return (
//     optionConfig[args.key](args.value) ?? {
//       label: 'ADD LABEL',
//       value: 'ADD VALUE'
//     }
//   )
// }
