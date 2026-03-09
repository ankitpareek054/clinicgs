function DataTable({columns,data}){

  return(

    <div
      style={{
        background:"white",
        borderRadius:"8px",
        border:"1px solid #e5e7eb",
        overflow:"visible",
        marginTop:"20px"
      }}
    >

      <table
        style={{
          width:"100%",
          borderCollapse:"collapse"
        }}
      >

        <thead style={{background:"#f9fafb"}}>

          <tr>

            {columns.map((column)=>(
              <th key={column.key} style={th}>
                {column.title}
              </th>
            ))}

          </tr>

        </thead>

        <tbody>

          {data.length === 0 ? (

            <tr>

              <td
                colSpan={columns.length}
                style={{
                  padding:"30px",
                  textAlign:"center",
                  color:"#6b7280",
                  fontSize:"14px"
                }}
              >

                No data found

              </td>

            </tr>

          ) : (

            data.map((row)=>(
              <tr key={row.id} style={rowStyle}>

                {columns.map((column)=>(
                  <td key={column.key} style={td}>

                    {column.render
                      ? column.render(row)
                      : row[column.key]}

                  </td>
                ))}

              </tr>
            ))

          )}

        </tbody>

      </table>

    </div>

  )

}

const th={
  textAlign:"left",
  padding:"14px",
  fontWeight:"600",
  fontSize:"14px"
}

const td={
  padding:"14px",
  fontSize:"14px"
}

const rowStyle={
  borderTop:"1px solid #f3f4f6"
}

export default DataTable