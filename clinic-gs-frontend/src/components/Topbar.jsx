function Topbar({setMenuOpen}){

  return(

    <div className="topbar">

      <button
        className="menu-btn"
        onClick={()=>setMenuOpen(true)}
      >
        ☰
      </button>

      <h3>Clinic GS</h3>

      <div>Admin</div>

    </div>

  )

}

export default Topbar