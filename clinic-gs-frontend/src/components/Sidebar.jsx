import { NavLink } from "react-router-dom"

import {
  FiHome,
  FiUsers,
  FiPhoneCall,
  FiCalendar,
  FiStar,
  FiSettings
} from "react-icons/fi"

function Sidebar({menuOpen,setMenuOpen}){

  return(

    <>
      {menuOpen && (
        <div
          className="overlay"
          onClick={()=>setMenuOpen(false)}
        />
      )}

      <div className={`sidebar ${menuOpen ? "open" : ""}`}>

        <h2>Clinic GS</h2>

        <nav>

          <NavLink to="/" onClick={()=>setMenuOpen(false)}>
            <FiHome /> Dashboard
          </NavLink>

          <NavLink to="/leads" onClick={()=>setMenuOpen(false)}>
            <FiUsers /> Leads
          </NavLink>

          <NavLink to="/followups" onClick={()=>setMenuOpen(false)}>
            <FiPhoneCall /> Followups
          </NavLink>

          <NavLink to="/appointments" onClick={()=>setMenuOpen(false)}>
            <FiCalendar /> Appointments
          </NavLink>

          <NavLink to="/reviews" onClick={()=>setMenuOpen(false)}>
            <FiStar /> Reviews
          </NavLink>

          <NavLink to="/settings" onClick={()=>setMenuOpen(false)}>
            <FiSettings /> Settings
          </NavLink>

        </nav>

      </div>
    </>

  )

}

export default Sidebar
