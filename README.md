# Markr Imports

## Running the app

```bash
# To run the app, run the following
docker compose up

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
- We may want to keep documents that are in a different/incorrect format. If it is complete data in an API we don't support, we can save the documents, add support for that kind of document, and then re-import these failing documents
- I have chosen post
