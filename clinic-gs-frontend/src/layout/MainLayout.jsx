import { useState } from "react"
import Sidebar from "../components/Sidebar"
import Topbar from "../components/Topbar"

function MainLayout({ children }) {

  const [menuOpen,setMenuOpen] = useState(false)

  return (

    <div className="layout">

      <Sidebar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <div className="main">

        <Topbar setMenuOpen={setMenuOpen} />

        <div className="content">
          {children}
        </div>

      </div>

    </div>

  )

}

export default MainLayout