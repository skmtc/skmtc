'use client'

import React, { useState } from 'react'
import type { CategoryPanelProps, CategoryInfo } from '../types'
import { DocNodeKindIcon } from './DocNodeKindIcon'
import { getKindTitle } from '../utils'

export const CategoryPanel: React.FC<CategoryPanelProps> = ({ categories }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const toggleCategory = (kind: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(kind)) {
      newExpanded.delete(kind)
    } else {
      newExpanded.add(kind)
    }
    setExpandedCategories(newExpanded)
  }

  const renderCategory = (category: CategoryInfo) => {
    const isExpanded = expandedCategories.has(category.kind)

    return (
      <div key={category.kind} className="mb-4">
        <button
          onClick={() => toggleCategory(category.kind)}
          className="flex items-center justify-between w-full p-2 text-left hover:bg-gray-100 rounded"
        >
          <div className="flex items-center">
            <DocNodeKindIcon kind={category.kind} />
            <span className="ml-2 font-semibold">{getKindTitle(category.kind)}</span>
            <span className="ml-2 text-sm text-gray-500">({category.items.length})</span>
          </div>
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {isExpanded && (
          <ul className="ml-8 mt-2 space-y-1">
            {category.items.map(item => (
              <li key={item.name}>
                <a href={item.href} className="block py-1 px-2 text-sm hover:bg-gray-100 rounded">
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-50 p-2 bg-white border rounded-lg shadow-lg lg:hidden"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-white border-r transform transition-transform z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:z-auto`}
      >
        <div className="p-4 h-full overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">API Reference</h2>

          {categories.map(renderCategory)}
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
