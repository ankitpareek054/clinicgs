import { createContext, useState } from "react";

export const LeadsContext = createContext();

export function LeadsProvider({ children }) {

  const [leads, setLeads] = useState([
    {
      id: 1,
      name: "Rahul Sharma",
      phone: "9876543210",
      service: "Dental Cleaning",
      source: "WhatsApp",
      status: "new"
    },
    {
      id: 2,
      name: "Anita Das",
      phone: "9123456789",
      service: "Hair Treatment",
      source: "Walk-in",
      status: "contacted"
    }
  ]);

  const createLead = (lead) => {
    setLeads([lead, ...leads]);
  };

  const updateLeadStatus = (id, status) => {
    const updated = leads.map((lead) =>
      lead.id === id ? { ...lead, status } : lead
    );

    setLeads(updated);
  };

  return (
    <LeadsContext.Provider
      value={{
        leads,
        createLead,
        updateLeadStatus
      }}
    >
      {children}
    </LeadsContext.Provider>
  );
}