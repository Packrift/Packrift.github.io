# Packrift Packaging Cost and Cube Index

Public-download staging package for the buyer-facing Packrift Packaging Cost and Cube Index.

- Source data generated: 2026-06-01
- Source package frozen: 2026-06-04
- Derived index prepared: 2026-07-09
- Source rows: 2,510
- Rows with an explicit title-parsed pack quantity: 2,478
- Buyer-facing metric cohort: 2,196 rows across six mapped product types

## Downloads

- `data/packrift-packaging-cost-cube-index.csv`
- `data/packrift-packaging-cost-cube-index.json`
- `data/data-dictionary.csv`
- `data/summary-by-family.csv`
- `data/cost-per-cube-bands.csv`
- `data/corrugated-cost-by-volume-band.csv`

## Method boundary

The estimated unit catalog price divides the dated public catalog price by one explicit pack quantity parsed from the product title. Catalog cost per cube then divides that estimated unit price by listed length x width x height in cubic feet. The family cost-cube index centers each buyer-facing family at 100.

This package is not a current-price promise, supplier-cost table, margin model, landed-cost calculation, freight quote, inventory commitment, or competitor comparison. It contains no Uline pricing and cannot support a relative price or savings conclusion about Uline or any other supplier. Listed catalog dimensions are not guaranteed usable internal capacity or carrier-rated freight cube.

No explicit reuse license is granted by this staging package. Packrift LLC retains applicable rights unless and until a license is separately approved.
