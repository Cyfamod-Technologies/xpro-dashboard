# CSV Data Import

## Flow

1. Manager downloads the current CSV template.
2. Manager selects country, Program, fiscal year, and default settings.
3. Manager uploads CSV.
4. Backend stores an import job and validates headers, types, locations, currencies, agencies, duplicates, and references.
5. UI presents totals, warnings, row errors, and a preview without creating public records.
6. Manager corrects and re-uploads or accepts valid rows according to policy.
7. Confirmation creates drafts attributed to the import job.
8. Manager reviews and submits drafts for Super Admin approval.
9. Import completion/failure is audited and notified.

Imports never bypass approval. Every imported record preserves source filename, row number, importer, timestamp, and validation outcome. Formula-like CSV content must be safely escaped in later exports.
