# Foundations React Vite Template

This repo is the template for building Reapit Foundations React apps, from v4 of Reapit Elements onwards. It replaces the earlier Create React App template, owing to the React team deciding to deprecate CRA.

It includes the usual Reapit Packages (Connect Session, Elements, TS Defintions), UI and Data fetching examples as well as some battle hardened libraries we use internally for building apps for example React Hook Form, React Query & Zustand.

As always, it should give you everything you need to get started building on the Reapit Foundations platform. For more documentation on our APIs and other resources, please visit our [developer portal](https://developers.reapit.cloud).

## Getting Started

First, if you don't have a Reapit Connect client id yet, will need to obtain one [here](https://developers.reapit.cloud/apps/new).

If you are creating a fresh client id or already have one but want to see the full functionality of the template, you will need to add the following scopes to your app `read contacts`, `write contacts`, `read negotiators` & `read offices` - you can always remove these scopes later if you don't need them.

Ensure also you have set `http://localhost:8080` as a redirect uri and `http://localhost:8080/login` as a logout uri in your app settings in the [developer portal](https://developers.reapit.cloud/apps).

The output app will create a simple CRUD contacts app to demonstrate the features of the platform.

### Prerequisites

- Node.js 18+
- Yarn 1+

First, run;

```
npx degit reapit/foundations-react-vite-template <<Your App Name>>
```

Then;

```
git init
```

And;

```
yarn
```

Add your `CONNECT_CLIENT_ID` to the `.env.example` file at the root of the project and rename it to `.env`.

Finally

```
yarn start
```

Each package has the following commands that can be run using yarn:

- `yarn start` will start a dev server at localhost:8080 with typechecking and linting enabled
- `yarn build` will build an app for production
- `yarn test` will run the Jest tests in watch mode
- `yarn test:ci` will run the Jest tests without watch and with coverage for use in CI environments
- `yarn lint` will run eslint and prettier accross the project
- `yarn check` will use tsc to type check the project
- `yarn upgrade:deps` will load a CLI to that allows you to update dependencies to their latest versions

## CI/CD and Releases

### Development & PRs

When raising a PR, the dedicated Github action workflow will run tests, linting, typechecking and build tasks against all packages that changed since `main`.
