import { useContext, useState } from "react"

import MainLayout from "../layout/MainLayout"
import PageHeader from "../components/PageHeader"
import DataTable from "../components/DataTable"
import StatusDropdown from "../components/StatusDropdown"
import CreateLeadModal from "../components/CreateLeadModal"

import { LeadsContext } from "../context/LeadsContext"

function Leads(){

  const { leads, createLead, updateLeadStatus } = useContext(LeadsContext)

  const [search,setSearch] = useState("")
  const [statusFilter,setStatusFilter] = useState("all")

  const filteredLeads = leads.filter((lead)=>{

    const matchesSearch =
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone.includes(search) ||
      lead.service.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === "all" || lead.status === statusFilter

    return matchesSearch && matchesStatus

  })

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
        title="Leads"
        subtitle="Manage clinic enquiries"
      />

      <CreateLeadModal onCreate={createLead}/>

      {/* SEARCH + FILTER */}

      <div
        style={{
          display:"flex",
          gap:"10px",
          marginTop:"20px",
          flexWrap:"wrap"
        }}
      >

        <input
          placeholder="Search name, phone or service..."
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(e)=>setStatusFilter(e.target.value)}
        >

          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="booked">Booked</option>
          <option value="lost">Lost</option>

        </select>

      </div>

      <DataTable
        columns={columns}
        data={filteredLeads}
      />

    </MainLayout>

  )

}

export default Leads