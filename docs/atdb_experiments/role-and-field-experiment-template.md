# Role and field experiment result

Use this template for `rec_table=6` custom event roles and `rec_table=10` data fields. Keep only redacted structural evidence.

## Metadata

- Experiment id:
- Date:
- ATDB app version:
- CLI command:
- CLI debug run path: `docs/atdb_experiments/runs/<id>.debug.log` (ignored)
- Baseline artifact path: `docs/atdb_experiments/runs/<id>.before.local.snapshot.json` (ignored)
- Modified artifact path: `docs/atdb_experiments/runs/<id>.after.local.snapshot.json` (ignored)

## Hypothesis

- `rec_table=6`: custom event participant roles.
- `rec_table=10`: user-defined "Поля данных" definitions or related records.

## Safe summary

- Status: `confirmed` / `observed` / `needs more samples` / `unknown`
- UI action:
- Affected tables:
- New rows count:
- Deleted rows count:
- Changed rows count:
- Affected `rec_table`:
- Affected `f_id`:
- Affected `Fields.id`:
- Affected `EventRoles.id`:
- Affected `EventTypes.id`:

## Redaction warnings

- No raw `ValuesStr.vstr`.
- No names, places, notes, source text, GUID or document paths.
- No before/after `.atdb` files are attached.

## Evidence

Paste only sanitized `schema:atdb:diff` summary lines:

```text
[safe-atdb-schema-diff] changes:
[safe-atdb-schema-diff] affected-rec-tables:
[safe-atdb-schema-diff] watched-rec-tables:
```

## Interpretation

- Structural link:
- Confidence reason:
- Unresolved questions:

## Safe error summary

- Error status:
- Safe reason:
- Blocker for interpretation: yes/no
