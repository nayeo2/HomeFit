import type { ComponentPropsWithoutRef } from 'react'

export function Card({ className = '', ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={`card ${className}`} {...props} />
}
