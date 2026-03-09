import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

import { LeadsProvider } from "./context/LeadsContext";
import { AppointmentsProvider } from "./context/AppointmentsContext";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <LeadsProvider>
      <AppointmentsProvider>
        <App />
      </AppointmentsProvider>
    </LeadsProvider>
  </React.StrictMode>
);