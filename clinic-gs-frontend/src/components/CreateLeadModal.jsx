import { useState } from "react";

function CreateLeadModal({ onCreate }) {

  const [name,setName] = useState("");
  const [phone,setPhone] = useState("");
  const [service,setService] = useState("");

  const handleSubmit = () => {

    const lead = {
      id: Date.now(),
      name,
      phone,
      service,
      source: "Walk-in",
      status: "new"
    };

    onCreate(lead);

    setName("");
    setPhone("");
    setService("");
  };

  return (

    <div
      style={{
        border: "1px solid #ddd",
        padding: "15px",
        marginBottom: "20px",
        background: "white"
      }}
    >

      <h3>Create Lead</h3>

      <div style={{ display: "flex", gap: "10px" }}>

        <input
          placeholder="Name"
          value={name}
          onChange={(e)=>setName(e.target.value)}
        />

        <input
          placeholder="Phone"
          value={phone}
          onChange={(e)=>setPhone(e.target.value)}
        />

        <input
          placeholder="Service"
          value={service}
          onChange={(e)=>setService(e.target.value)}
        />

        <button onClick={handleSubmit}>
          Create
        </button>

      </div>

    </div>
  );
}

export default CreateLeadModal;