# Unknown rec_table experiment result

Use this template for `rec_table=8`, `18`, `21` and other low-count or unknown records. Keep only structural changes and one isolated UI action per experiment.

## Metadata

- Experiment id:
- Date:
- ATDB app version:
- CLI command:
- Verbose CLI log path: `docs/atdb_experiments/runs/<id>.verbose.log` (ignored)
- Baseline artifact path: `docs/atdb_experiments/runs/<id>.before.local.snapshot.json` (ignored)
- Modified artifact path: `docs/atdb_experiments/runs/<id>.after.local.snapshot.json` (ignored)

## Candidate

- Candidate `rec_table`:
- Candidate `f_id`:
- Initial confidence: `unknown`
- UI action:

## Safe summary

- Status: `confirmed` / `observed` / `needs more samples` / `unknown`
- Affected tables:
- Row count deltas:
- Affected `rec_table`:
- Affected `f_id`:
- Link target deltas:
- Related table count deltas:

## Ambiguity warnings

- Single diff is not enough for `confirmed`.
- Count match alone is `observed`, not `confirmed`.
- `Fields.area` is not a reliable semantic source.
- Do not increase confidence without repeatable diff evidence.

## Evidence

Paste only sanitized `schema:atdb:diff` summary lines:

```text
[safe-atdb-schema-diff] changes:
[safe-atdb-schema-diff] affected-rec-tables:
[safe-atdb-schema-diff] watched-rec-tables:
```

## Interpretation

- Structural link:
- Repeatability evidence:
- Confidence reason:
- Unresolved questions:

## Safe failure reason

- Error status:
- Safe reason:
- Blocker for interpretation: yes/no
