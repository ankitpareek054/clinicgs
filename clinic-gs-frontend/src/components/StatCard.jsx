function StatCard({title,value}){

  return(

    <div
      style={{
        background:"white",
        padding:"20px",
        borderRadius:"8px",
        border:"1px solid #e5e7eb",
        flex:1
      }}
    >

      <p
        style={{
          margin:0,
          color:"#6b7280",
          fontSize:"14px"
        }}
      >
        {title}
      </p>

      <h2
        style={{
          marginTop:"10px",
          marginBottom:0
        }}
      >
        {value}
      </h2>

    </div>

  )

}

export default StatCard