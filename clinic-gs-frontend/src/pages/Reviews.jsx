import { useState } from "react"

import MainLayout from "../layout/MainLayout"
import PageHeader from "../components/PageHeader"
import DataTable from "../components/DataTable"

function Reviews(){

  const [reviews]=useState([
    {
      id:1,
      name:"Rahul Sharma",
      rating:5,
      feedback:"Great experience"
    },
    {
      id:2,
      name:"Anita Das",
      rating:3,
      feedback:"Wait time was long"
    }
  ])

  const columns=[

    {key:"name",title:"Patient"},

    {
      key:"rating",
      title:"Rating",
      render:(row)=>`${row.rating} ⭐`
    },

    {key:"feedback",title:"Feedback"}

  ]

  return(

    <MainLayout>

      <PageHeader
        title="Reviews"
        subtitle="Patient feedback"
      />

      <DataTable
        columns={columns}
        data={reviews}
      />

    </MainLayout>

  )

}

export default Reviews