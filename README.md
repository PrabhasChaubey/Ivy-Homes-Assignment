# Ivy Homes — Software Engineering Internship Assignment

## Overview

This repository contains both parts of the assignment:

1. **API investigation and data analysis** in the repository root.
2. **Next.js frontend** inside `ivy-frontend/`.

The implementation was built against the live Ivy Homes API, using the API's observed behavior as the source of truth whenever it conflicted with the supplied documentation.

## Repository structure

```text
IVY Assignment/
├── data/                         # Retrieved API datasets and fetch metadata
├── ivy-frontend/                 # Next.js + TypeScript frontend
│   ├── app/                      # Login, listings, detail, saved, rentals, projects, insights
│   ├── components/               # Shared UI components
│   ├── lib/                      # API client, auth context, data/analytics, favourites
│   ├── public/
│   ├── package.json
│   └── ...
├── analyze.mjs                   # Analysis of the retrieved datasets
├── fetch-data.mjs                # Full-dataset API fetcher
├── inspect-mag.mjs               # Targeted investigation of area-unit anomalies
├── test-analytics.mjs            # Analytics endpoint checks
├── test-favourites.mjs           # Favourites endpoint checks
├── test-pagination.mjs           # Pagination behavior checks
├── test-refresh.mjs              # Refresh-token contract check
├── output.txt                    # Captured analysis output
├── HYPOTHESES.md                 # Investigation checklist
├── API_REFERENCE.md              # Supplied API documentation
├── data/                          # JSON output from the investigation
├── submission.json               # Assignment answers + API findings
└── README.md                     # This file
```

The root contains the investigation scripts because the analysis was performed independently of the frontend. The frontend consumes the live API directly and has its own `.env.local` file.

## Running the frontend

From the repository root:

```bash
cd ivy-frontend
npm install
```

Create `ivy-frontend/.env.local`:

```env
NEXT_PUBLIC_IVY_BASE_URL=https://solve.ivy.homes
NEXT_PUBLIC_IVY_API_KEY=YOUR_ASSIGNED_API_KEY
```

Then run:

```bash
npm run dev
```

Open `http://localhost:3000` and use one of the assigned demo accounts.

`.env.local` must not be committed.

## Running the data collection and analysis

The investigation scripts live at the repository root. They require a valid Ivy Homes API key and demo credentials through environment variables.

Set:

```text
IVY_BASE_URL=https://solve.ivy.homes
IVY_API_KEY=<your assigned API key>
IVY_EMAIL=<assigned demo email>
IVY_PASSWORD=<assigned demo password>
```

Then run:

```bash
node fetch-data.mjs
node analyze.mjs
```

`fetch-data.mjs` writes the retrieved collections to `data/` and records both the declared and actually retrieved counts. The fetcher does **not** stop when the API's `total` is reached; it continues until the server returns an empty page because the declared totals proved unreliable.

The targeted checks can be run independently:

```bash
node test-pagination.mjs
node test-refresh.mjs
node test-favourites.mjs
node test-analytics.mjs
node inspect-mag.mjs
```

## How I decided what to distrust

I treated the supplied API reference as a hypothesis rather than as ground truth. I tested authentication, response shapes, pagination, completeness, timestamps, data units, cross-record consistency, and the documented favourites/analytics endpoints directly against the running API.

## AI / LLM Usage

I used an LLM as part of the development and investigation process,
including API hypothesis generation, debugging and analysis scripting. All resulting code, API behavior,
data findings, and submission claims were reviewed and verified
against the running API.

### Authentication

The documentation describes the API key as a query parameter. The live API instead requires `X-API-Key` as a request header, including on `/auth/login`.

The login response also differs from the documentation: it provides `access_token`, `refresh_token`, `refresh_url`, and `expires_in: 900`. The refresh contract was tested and the frontend uses it so a logged-in session can survive beyond the 15-minute access-token lifetime.

### Pagination and completeness

The documented `page` parameter is ignored. Testing showed that `offset` actually advances the result window, and the server caps a request at 50 records even when `limit=200` is requested.

More importantly, `total` is not the real retrievable count. Paging until an actually empty result gives:

| Endpoint | Documented `total` | Actually retrievable |
| --- | ---: | ---: |
| `/v1/listings` | 3879 | **4100** |
| `/v1/rentals` | 1466 | **1550** |
| `/v1/projects` | 435 | **460** |

Therefore the analysis and frontend use offset pagination to exhaustion rather than trusting the documented page mechanism or `total`.

### Listings are not active-only

`/v1/listings` contains an undocumented `is_live` field. The complete dataset contains 3233 live records and 867 records with `is_live=false`.

The frontend consequently filters on `is_live` when an active-listings view is required instead of assuming every returned listing is active.

### Missing documented endpoints

`/v1/favourites` does not exist at the documented path; the tested methods/path variants returned 404. The saved-listings requirement is therefore implemented client-side with `localStorage`, keyed by the logged-in user's email, so saved IDs remain separate for different users and persist through reload/re-login.

`/v1/analytics/summary` is also unavailable. The Insights screen therefore computes its aggregates from the listing dataset already fetched and verified by the client instead of depending on a dead endpoint.

### Data units

Project `price_min`/`price_max` values are crore-scale even though the documentation describes them as rupees. The maximum is project `P40231` with `price_max=99.8`, which corresponds to **₹998,000,000**.

For listing areas, 326 individual records have carpet and super-built-up values consistent with square metres rather than square feet. A source-wide hypothesis was tested and rejected: all five website prefixes have healthy carpet/super-built-up ratios. The units issue is therefore scoped to individual records rather than an entire source.

The final corruption and 2-BHK calculations were based on the corrected interpretation of those records.

## What I checked that turned out to be fine

I intentionally kept disproved hypotheses out of the final findings instead of padding the findings list.

First, the initial hypothesis that all `MAG-*` records used square metres was wrong. Source-level ratios were consistent with the other websites; only a smaller set of individual records showed the area-unit anomaly.

Second, a phone number appearing on many listings was not treated as automatic fraud. Several high-volume numbers were associated with normal pricing and varied seller identities. The fake-listing conclusion was kept narrow rather than classifying an entire phone-number cluster as fake.

Third, listing `posted_at` values were observed in UTC `Z` format as expected. The timestamp discrepancy was limited to `/health`, whose `server_time` used an explicit `+05:30` offset.

## Final answers

| Field | Final answer |
| --- | ---: |
| `total_listing_records` | **4100** |
| `unique_properties` | **4075** |
| `active_listings` | **3233** |
| `corrupt_listing_ids` | **45** |
| `total_monthly_rent` | **5,522,600** |
| `avg_price_per_sqft_2bhk` | **9,840.78** |
| `costliest_project` | **P40231 — ₹998,000,000** |
| `listings_last_7_days` | **122** |
| `fake_listing_ids` | **100-4003487, DWE-4003375** |
| `projects_with_wrong_listing_count` | **119** |

### Q2 note

`4075` is the least authoritative of the ten answers because the dataset does not expose a canonical physical-property identifier. It is the result of a deterministic clustering heuristic using rounded coordinates, bedroom count, and carpet area, followed by manual inspection of representative duplicate clusters. The uncertainty is deliberately documented rather than hidden.

### Q6 note

The fake-listing IDs selected for Q9 are 3-BHK records. Q6 only includes live 2-BHK records, so excluding the Q9 IDs does not change the Q6 population or the reported mean.

## Main API findings included in `submission.json`

The findings list records the discrepancies reproduced against the live API, including:

- `X-API-Key` authentication instead of the documented query parameter.
- `X-API-Key` also required by `/auth/login`.
- `access_token` + `refresh_token` + `/auth/refresh`, with 15-minute access-token expiry.
- `page` ignored; `offset` is the actual pagination mechanism.
- 50-record response cap instead of the documented 200.
- `total` undercounting the retrievable collections.
- `/v1/listings` returning `is_live=false` records despite the active-only documentation.
- Project prices stored in crores rather than rupees.
- Per-record listing area values inconsistent with the documented square-foot unit.
- Missing `/v1/favourites` endpoint.
- Missing `/v1/analytics/summary` endpoint.
- `/health.server_time` using `+05:30` rather than the documented UTC `Z` format.
- A narrow duplicate-property finding and a narrow fake-listing finding, with record-level evidence.

The assignment explicitly rewards precision in findings, so the repository avoids turning weak signals into claims.

