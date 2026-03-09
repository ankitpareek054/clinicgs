import { useContext } from "react"

import MainLayout from "../layout/MainLayout"
import PageHeader from "../components/PageHeader"
import DataTable from "../components/DataTable"
import StatusDropdown from "../components/StatusDropdown"

import { LeadsContext } from "../context/LeadsContext"

function Followups(){

  const { leads, updateLeadStatus } = useContext(LeadsContext)

  const followupLeads=leads.filter(
    (lead)=>lead.status==="contacted"
  )

  const columns=[

    {key:"name",title:"Name"},
    {key:"phone",title:"Phone"},
    {key:"service",title:"Service"},
    {key:"source",title:"Source"},

    {
      key:"status",
      title:"Status",
      render:(row)=>(
        <StatusDropdown
          value={row.status}
          onChange={(status)=>updateLeadStatus(row.id,status)}
        />
      )
    }

  ]

  return(

    <MainLayout>

      <PageHeader
        title="Followups"
        subtitle="Leads requiring follow-up"
      />

      <DataTable
        columns={columns}
        data={followupLeads}
      />

    </MainLayout>

  )

}

export default Followups