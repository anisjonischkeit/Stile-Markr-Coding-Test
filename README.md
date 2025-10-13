# Markr Imports

The Markr Imports service handles importing test results and showing aggregate information about tests. It is written in typescript and uses postgres as a data store. Zod is used to validate the incoming test results and assert validity. Drizzle is used to manage database schema migrations and query building. Postgres was chosen as it is a sensible default and for this poc it made sense to just pick "something". Upserts are used to handle test resubmissions and aggregates are calculated by the database for performance.

## Running the app

### Prerequisites

- Docker & Docker Compose
- Node.js 23+ (for development)

```bash
# To run the app, run the following
docker compose up

# Test it's working
curl http://localhost:4567/import -X POST -H "Content-Type: text/xml+markr" -d '<mcq-test-results><mcq-test-result scanned-on="2017-12-04T12:12:10+11:00"><first-name>Test</first-name><last-name>User</last-name><student-number>12345</student-number><test-id>999</test-id><summary-marks available="20" obtained="15" /></mcq-test-result></mcq-test-results>'

# Check aggregates
curl http://localhost:4567/results/999/aggregate

# If you have installed new packages you will also need to rebuild the docker container
docker compose build
```

## Running the tests

> NOTE: To run the tests, you must have the app running

```bash
# make sure to start the app
docker compose up

# run the tests
pnpm test

# or run them in watch mode
pnpm test:watch
```

## API Endpoints

### POST /import

Ingests XML test results

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<mcq-test-results>
    <mcq-test-result scanned-on="2017-01-01T00:00:00Z">
        <first-name>Jimmmy</first-name>
        <last-name>Student</last-name>
        <student-number>99999999</student-number>
        <test-id>78763</test-id>
        <summary-marks available="10" obtained="2" />
        <answer question="1" marks-available="1" marks-awarded="1">A</answer>
        <answer question="2" marks-available="1" marks-awarded="0">B</answer>
        <answer question="4 marks-available="1" marks-awarded="1">AC</answer>
    </mcq-test-result>
    ...more mcq-test-result elements follow...
</mcq-test-results>
```

- **Content-Type**: `text/xml+markr`
- **Response**: 200 on success, 400 on invalid XML

### GET /results/:test-id/aggregate

Returns test statistics as percentages

```json
{
  "mean": 75.0,
  "count": 100,
  "p25": 65.0,
  "p50": 75.0,
  "p75": 85.0,
  "min": 30.0,
  "max": 100.0
}
```

## Scaling for Real-time Dashboards

Current implementation handles moderate loads efficiently. For real-time dashboards we might explore the following strategies:

1. **Materialized Views** - Pre-computed aggregates refreshed on data changes

> NOTE: this will need to take into account all of the data for each update of the Materialized View

2. **Aggregate Table** - A table that tracks the current aggregates and gets updated with each data point insert. The tricky part about this is that a student's result can be updated (due to a bad scan) and we need to make sure we take that into account with our aggregate (so a student is never counted twice)
3. **Read Replicas** - Separate analytics queries from ingestion writes

## Assumptions

- Authentication is handled outside of this service
- numbers for marks are whole numbers
- Since this is just a poc, the docker compose file does a few things that we probably want to turn off when we go to prod:
  - it does not use built assets, instead runs the server in watch mode
  - it runs a database migration on startup (we probably want to define a strategy around DB migrations)
- tests currently run against the same local postgres instance. This works but is not ideal for a few reasons:
  1. running tests will wipe the local DB
  2. you can't run tests in parallel as they are sharing a single db
- We may want to keep badly scanned documents (that in the current implementation are just overwritten)
- We may want to keep documents that are in a different/incorrect format. If it is complete data in a format we don't support, we can save the documents, add support for that kind of document, and then re-import these failing documents
