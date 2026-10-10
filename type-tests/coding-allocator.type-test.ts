import type { GcsCodingAllocator } from '../src/server'

const allocator: GcsCodingAllocator = context => [{ codingLineId: context.codingLines[0]!.codingLineId, amount: context.amount }]
void allocator

// @ts-expect-error Allocator money must be exact decimal text.
const numericAllocator: GcsCodingAllocator = () => [{ codingLineId: '1', amount: 10 }]
void numericAllocator

const manualAllocator: GcsCodingAllocator = () => null
void manualAllocator

const paymentAllocator: GcsCodingAllocator = context => {
  if (context.output.kind !== 'payment') return null
  const commitmentId: string = context.output.commitmentId
  const commitmentTypeId: string = context.output.commitmentTypeId
  const fiscalYearId: string = context.output.fiscalYearId
  void [commitmentId, commitmentTypeId, fiscalYearId, context.db]
  return context.codingAvailableAmounts.map(line => ({ codingLineId: line.codingLineId, amount: line.amount }))
}
void paymentAllocator
