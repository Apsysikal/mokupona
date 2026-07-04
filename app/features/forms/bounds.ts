// Limits exist to bound the blast radius of bugs and abuse, not to police
// authors; legitimate forms never hit them. MAX_LIST_COUNT is security
// relevant: submission arrays on public endpoints validate against a stored
// maxCount that can never exceed it.
export const MAX_TOTAL_FIELDS = 40; // counts recursively: top-level + every list's itemFields
export const MAX_LIST_COUNT = 10; // ceiling in code; authors pick a value 0..MAX in data
