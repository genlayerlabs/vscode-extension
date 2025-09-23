# Hover Provider Documentation Links Test

## Updated Documentation Links

### Type Documentation Links (✅ Fixed)
- **Integer Types** (u8, u16, u32, u64, u128, u256, i8-i256, bigint)
  - Old: `https://docs.genlayer.com/types#u256` (404)
  - New: `https://docs.genlayer.com/developers/intelligent-contracts/types/primitive` ✅

- **Address Type**
  - Old: `https://docs.genlayer.com/types#address` (404)
  - New: `https://docs.genlayer.com/developers/intelligent-contracts/types/address` ✅

- **Collection Types** (TreeMap, DynArray)
  - Old: `https://docs.genlayer.com/types#treemap` (404)
  - New: `https://docs.genlayer.com/developers/intelligent-contracts/types/collections` ✅

### API Documentation Links (✅ Fixed)
- **gl.ContractAt**
  - Old: `https://docs.genlayer.com/api#contractat` (404)
  - New: `https://docs.genlayer.com/developers/intelligent-contracts/advanced-features/contract-to-contract-interaction` ✅

- **Equivalence Principles** (strict_eq, prompt_comparative, prompt_non_comparative)
  - Old: `https://docs.genlayer.com/consensus#strict-eq` (404)
  - New: `https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle` ✅

### Removed Documentation Links (✅ Fixed)
- **Decorators** (@gl.public.view, @gl.public.write)
  - Old: Had broken links to non-existent pages
  - New: No documentation links shown (as these don't have dedicated pages)

## Testing Instructions

1. Open a GenVM contract file in VS Code with the extension installed
2. Hover over the following items and verify documentation links:
   - Any integer type (u256, u64, etc.) - should link to primitive types page
   - Address type - should link to address page
   - TreeMap or DynArray - should link to collections page
   - gl.ContractAt - should link to contract interaction page
   - gl.eq_principle methods - should link to equivalence principle page
   - @gl.public decorators - should NOT show documentation links

## Summary

All documentation links have been updated to match the actual structure of the genlayer-docs project. Links that would lead to 404 pages have been either corrected or removed entirely.