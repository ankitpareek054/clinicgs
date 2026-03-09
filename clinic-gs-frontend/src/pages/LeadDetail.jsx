import { useParams } from "react-router-dom"

import MainLayout from "../layout/MainLayout"
import PageHeader from "../components/PageHeader"

function LeadDetail(){

  const { id } = useParams()

  return(

    <MainLayout>

      <PageHeader
        title="Lead Details"
        subtitle={`Lead ID: ${id}`}
      />

      <p>Lead information will appear here.</p>

    </MainLayout>

  )

}

export default LeadDetail