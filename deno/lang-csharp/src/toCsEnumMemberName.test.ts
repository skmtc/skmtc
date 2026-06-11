import { assertEquals } from '@std/assert'
import { toCsEnumMemberName, toCsEnumMemberNames } from './toCsEnumMemberName.ts'

Deno.test('PascalCases wire values across separator styles', () => {
  assertEquals(toCsEnumMemberName('in-progress'), 'InProgress')
  assertEquals(toCsEnumMemberName('not_started'), 'NotStarted')
  assertEquals(toCsEnumMemberName('inProgress'), 'InProgress')
  assertEquals(toCsEnumMemberName('DONE'), 'Done')
  assertEquals(toCsEnumMemberName('a b c'), 'ABC')
})

Deno.test('digit-leading results get the _ prefix; empty residue pins to Empty', () => {
  assertEquals(toCsEnumMemberName('123'), '_123')
  assertEquals(toCsEnumMemberName('1st-place'), '_1stPlace')
  assertEquals(toCsEnumMemberName(''), 'Empty')
  assertEquals(toCsEnumMemberName('+'), 'Empty')
})

Deno.test('collisions take numeric suffixes', () => {
  const members = toCsEnumMemberNames(['a-b', 'a_b'])

  assertEquals(members, [
    { name: 'AB', wireValue: 'a-b' },
    { name: 'AB2', wireValue: 'a_b' }
  ])
})

Deno.test('dedup checks the FULL produced-name set, not a per-base counter (the A_B_2 lesson)', () => {
  // With a per-base counter, 'a_b' would produce 'AB2' — colliding with
  // the wire-derived 'AB2' already in the set.
  const members = toCsEnumMemberNames(['a-b', 'AB-2', 'a_b'])

  assertEquals(members, [
    { name: 'AB', wireValue: 'a-b' },
    { name: 'Ab2', wireValue: 'AB-2' },
    { name: 'AB2', wireValue: 'a_b' }
  ])

  const names = members.map(member => member.name)
  assertEquals(new Set(names).size, names.length)
})

Deno.test('suffixed names themselves dodge later collisions', () => {
  const members = toCsEnumMemberNames(['x', 'x', 'x2'])

  assertEquals(members, [
    { name: 'X', wireValue: 'x' },
    { name: 'X2', wireValue: 'x' },
    { name: 'X22', wireValue: 'x2' }
  ])
})

Deno.test('reserved pre-seed dodges CS0542 (member name == enclosing type name)', () => {
  const members = toCsEnumMemberNames(['status', 'archived'], { reserved: ['Status'] })

  assertEquals(members, [
    { name: 'Status2', wireValue: 'status' },
    { name: 'Archived', wireValue: 'archived' }
  ])
})
