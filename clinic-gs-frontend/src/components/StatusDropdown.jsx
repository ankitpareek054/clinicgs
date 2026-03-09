import { useState } from "react"

const statuses = [
  "new",
  "contacted",
  "booked",
  "completed",
  "closed",
  "no_show"
]

function StatusDropdown({ value, onChange }) {

  const [open,setOpen] = useState(false)

  const getColor = (status) => {

    switch(status){
      case "new": return "#3b82f6"
      case "contacted": return "#f59e0b"
      case "booked": return "#10b981"
      case "completed": return "#6366f1"
      case "closed": return "#6b7280"
      case "no_show": return "#ef4444"
      default: return "#6b7280"
    }

  }

  return (

    <div style={{position:"relative",display:"inline-block"}}>

      {/* STATUS BUTTON */}

      <button
        onClick={()=>setOpen(!open)}
        style={{
          background:getColor(value),
          color:"white",
          border:"none",
          padding:"6px 12px",
          borderRadius:"6px",
          fontSize:"14px",
          cursor:"pointer",
          display:"flex",
          alignItems:"center",
          gap:"6px",
          textTransform:"capitalize"
        }}
      >

        {value.replace("_"," ")}

        <span style={{fontSize:"12px"}}>▼</span>

      </button>

      {/* DROPDOWN */}

      {open && (

        <div
          style={{
            position:"absolute",
            top:"38px",
            left:0,
            background:"white",
            border:"1px solid #e5e7eb",
            borderRadius:"6px",
            width:"150px",
            boxShadow:"0 4px 12px rgba(0,0,0,0.1)",
            zIndex:999
          }}
        >

          {statuses.map((status)=>(

            <div
              key={status}

              onClick={()=>{

                onChange(status)
                setOpen(false)

              }}

              onMouseEnter={(e)=>e.target.style.background="#f3f4f6"}
              onMouseLeave={(e)=>e.target.style.background="white"}

              style={{
                padding:"8px 12px",
                cursor:"pointer",
                fontSize:"14px",
                textTransform:"capitalize"
              }}
            >

              {status.replace("_"," ")}

            </div>

          ))}

        </div>

      )}

    </div>

  )

}

export default StatusDropdown