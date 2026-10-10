import type { GcsCodingAllocator } from '../src/server'

const allocator: GcsCodingAllocator = context => [{ codingLineId: context.codingLines[0]!.codingLineId, amount: context.amount }]
void allocator

// @ts-expect-error Allocator money must be exact decimal text.
const numericAllocator: GcsCodingAllocator = () => [{ codingLineId: '1', amount: 10 }]
void numericAllocator
