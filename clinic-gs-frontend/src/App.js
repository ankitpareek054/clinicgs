import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Appointments from "./pages/Appointments";
import Followups from "./pages/Followups";
import Reviews from "./pages/Reviews";
import Settings from "./pages/Settings";
import LeadDetail from "./pages/LeadDetail";

function App() {
  return (
    <BrowserRouter>

      <Routes>

        <Route path="/" element={<Dashboard />} />

        <Route path="/leads" element={<Leads />} />

        <Route path="/leads/:id" element={<LeadDetail />} />

        <Route path="/appointments" element={<Appointments />} />

        <Route path="/followups" element={<Followups />} />

        <Route path="/reviews" element={<Reviews />} />

        <Route path="/settings" element={<Settings />} />

      </Routes>

    </BrowserRouter>
  );
}

export default App;