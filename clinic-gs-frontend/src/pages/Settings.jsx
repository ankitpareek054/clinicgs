import { useState } from "react"

import MainLayout from "../layout/MainLayout"
import PageHeader from "../components/PageHeader"

function Settings(){

  const [clinicName,setClinicName]=useState("SmileCare Dental")
  const [phone,setPhone]=useState("9876543210")
  const [address,setAddress]=useState("Guwahati")

  const saveSettings=()=>{
    alert("Settings saved")
  }

  return(

    <MainLayout>

      <PageHeader
        title="Settings"
        subtitle="Clinic configuration"
      />

      <div
        style={{
          background:"white",
          padding:"20px",
          border:"1px solid #e5e7eb",
          borderRadius:"8px",
          maxWidth:"500px"
        }}
      >

        <div style={field}>
          <label>Clinic Name</label>

          <input
            value={clinicName}
            onChange={(e)=>setClinicName(e.target.value)}
          />
        </div>

        <div style={field}>
          <label>Phone</label>

          <input
            value={phone}
            onChange={(e)=>setPhone(e.target.value)}
          />
        </div>

        <div style={field}>
          <label>Address</label>

          <input
            value={address}
            onChange={(e)=>setAddress(e.target.value)}
          />
        </div>

        <button onClick={saveSettings}>
          Save Settings
        </button>

      </div>

    </MainLayout>

  )

}

const field={
  display:"flex",
  flexDirection:"column",
  marginBottom:"15px"
}

export default Settings