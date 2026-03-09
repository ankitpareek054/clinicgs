import { createContext, useState } from "react";

export const AppointmentsContext = createContext();

export function AppointmentsProvider({ children }) {

  const [appointments, setAppointments] = useState([
    {
      id: 1,
      name: "Rahul Sharma",
      phone: "9876543210",
      service: "Dental Cleaning",
      time: "10:30 AM",
      status: "booked"
    },
    {
      id: 2,
      name: "Anita Das",
      phone: "9123456789",
      service: "Hair Treatment",
      time: "12:00 PM",
      status: "completed"
    }
  ]);

  const updateAppointmentStatus = (id, status) => {

    const updated = appointments.map((appointment) =>
      appointment.id === id ? { ...appointment, status } : appointment
    );

    setAppointments(updated);

  };

  return (
    <AppointmentsContext.Provider
      value={{
        appointments,
        updateAppointmentStatus
      }}
    >
      {children}
    </AppointmentsContext.Provider>
  );
}