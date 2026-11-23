import { ClientApp } from './client-app';

/**
 * A felület minden útvonalon (a landing, a belépés, a regisztráció, a dashboard) ugyanaz az egyoldalas alkalmazás: az
 * útvonalat az alkalmazás maga kezeli (History API). Az `/api` és a `/widget` útvonalak külön végpontok, ezeket nem érinti.
 */
export default function Page() {
  return <ClientApp />;
}
