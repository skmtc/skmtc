import { Link } from 'react-router-dom'

type LinkFormatterProps = {
  to: string
  children: React.ReactNode
}

export const LinkFormatter = ({ to, children }: LinkFormatterProps) => {
  return <Link to={to}>{children}</Link>
}
