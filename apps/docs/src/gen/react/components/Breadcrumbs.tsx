import React from 'react'
import { ArrowIcon } from './Icon'

interface BreadcrumbPart {
  name: string
  href?: string
  isFirstSymbol?: boolean
  isSymbol?: boolean
}

interface BreadcrumbsProps {
  parts?: BreadcrumbPart[]
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ parts }) => {
  const symbolParts = parts?.filter(part => part.isSymbol)

  return (
    <ul className="breadcrumbs">
      {parts?.map((part, index) => {
        const isLast = index === parts.length - 1
        const isFirstSymbol = part.isFirstSymbol

        return (
          <React.Fragment key={index}>
            {isFirstSymbol && (
              <ul>
                {symbolParts?.map((symbolPart, symbolIndex) => (
                  <li key={symbolIndex}>
                    {symbolIndex === symbolParts.length - 1 ? (
                      symbolPart.name
                    ) : (
                      <a href={symbolPart.href} className="contextLink">
                        {symbolPart.name}
                      </a>
                    )}
                    {symbolIndex < symbolParts.length - 1 && <span>.</span>}
                  </li>
                ))}
              </ul>
            )}

            {!part.isSymbol && (
              <>
                <li>
                  {isLast ? (
                    part.name
                  ) : (
                    <a href={part.href} className="contextLink">
                      {part.name}
                    </a>
                  )}
                </li>

                {!isLast && (
                  <span className="text-black dark:text-white">
                    <ArrowIcon />
                  </span>
                )}
              </>
            )}
          </React.Fragment>
        )
      })}
    </ul>
  )
}
