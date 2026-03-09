function PageHeader({ title, subtitle, action }) {

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px"
      }}
    >

      <div>
        <h1 style={{ margin: 0 }}>{title}</h1>

        {subtitle && (
          <p style={{ color: "#6b7280", marginTop: "5px" }}>
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div>
          {action}
        </div>
      )}

    </div>
  );
}

export default PageHeader;