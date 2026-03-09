import { useContext } from "react"

import MainLayout from "../layout/MainLayout"
import PageHeader from "../components/PageHeader"
import DataTable from "../components/DataTable"
import StatusDropdown from "../components/StatusDropdown"

import { AppointmentsContext } from "../context/AppointmentsContext"

function Appointments(){

  const { appointments, updateAppointmentStatus } =
    useContext(AppointmentsContext)

  const columns=[

    {key:"name",title:"Patient"},
    {key:"phone",title:"Phone"},
    {key:"service",title:"Service"},
    {key:"time",title:"Time"},

    {
      key:"status",
      title:"Status",
      render:(row)=>(
        <StatusDropdown
          value={row.status}
          onChange={(status)=>updateAppointmentStatus(row.id,status)}
        />
      )
    }

  ]

  return(

    <MainLayout>

      <PageHeader
        title="Appointments"
        subtitle="Manage clinic appointments"
      />

      <DataTable
        columns={columns}
        data={appointments}
      />

    </MainLayout>

  )

}

export default Appointments