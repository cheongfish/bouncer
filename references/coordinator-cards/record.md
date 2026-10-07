# record

Contract card for the `coordinate next` action `record`. Rules are copied from
the coordinator Procedure step 3 (Drive).

- Only an `accepted` report may run the `record` `argv` so `bouncer coordinate
  record` stores its result SHA together with a decision naming the paths the
  task actually changed.
- `record` stores the SHA and that decision, so provenance the ledger must
  keep travels inside the decision text.
- A missing or mismatched Brief revision is stale: do not call `accepted` or
  `coordinate record`, and keep the attempt open.
