// TODO - These chips should be in Elements, need to add at a later release
import { styled } from '@linaria/react'

export const DisplayChip = styled.div`
  background: var(--color-grey-light);
  color: var(--color-grey-dark);
  font-size: var(--font-size-small);
  border-radius: 1rem;
  padding: 0.25rem 0.625rem;
  margin: 0.25rem 0.5rem 0.25rem 0;
  display: inline-block;
`

export const LinkChip = styled.div`
  background: var(--color-grey-light);
  color: var(--color-grey-dark);
  font-size: var(--font-size-small);
  border-radius: 1rem;
  padding: 0.25rem 0.625rem;
  margin: 0.25rem 0.5rem 0.25rem 0;
  display: inline-block;
  cursor: pointer;

  &:hover {
    color: var(--intent-primary);
  }
`
