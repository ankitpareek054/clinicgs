import MainLayout from "../layout/MainLayout"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"

function Dashboard(){

  const stats={
    leadsToday:12,
    bookingsToday:7,
    noShows:2,
    pendingFollowups:5
  }

  return(

    <MainLayout>

      <PageHeader
        title="Dashboard"
        subtitle="Clinic performance overview"
      />

      <div
  style={{
    display:"grid",
    gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",
    gap:"20px"
  }}
>

        <StatCard
          title="Leads Today"
          value={stats.leadsToday}
        />

        <StatCard
          title="Bookings Today"
          value={stats.bookingsToday}
        />

        <StatCard
          title="No Shows"
          value={stats.noShows}
        />

        <StatCard
          title="Pending Followups"
          value={stats.pendingFollowups}
        />

      </div>

    </MainLayout>

  )

}

export default Dashboard