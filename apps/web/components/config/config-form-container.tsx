import * as React from 'react'
import { Button } from '@/components/ui/button'
import { FormEvent, ReactNode } from 'react'

type ConfigFormContainerProps = {
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
  children: ReactNode
}

export function ConfigFormContainer({ onSubmit, onCancel, children }: ConfigFormContainerProps) {
  return (
    <form className="flex flex-col gap-2 px-2 pt-2" onSubmit={onSubmit}>
      {children}
      <div className="flex justify-end gap-4 pt-2">
        <Button
          variant="ghost"
          className="px-2 py-1 h-auto text-indigo-600 hover:text-indigo-700"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="px-2 py-1 h-auto bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Add
        </Button>
      </div>
    </form>
  )
}
