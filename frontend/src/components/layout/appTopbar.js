"use client";



import ThemeToggle from "../shared/themeToggle";



function BuildingIcon() {

  return (

    <svg

      viewBox="0 0 24 24"

      aria-hidden="true"

      className="clinic-chip-icon"

      fill="none"

    >

      <path

        d="M4 20V6.5C4 5.67 4.67 5 5.5 5H11V20"

        stroke="currentColor"

        strokeWidth="1.7"

        strokeLinecap="round"

        strokeLinejoin="round"

      />

      <path

        d="M11 20V3.5C11 2.67 11.67 2 12.5 2H18.5C19.33 2 20 2.67 20 3.5V20"

        stroke="currentColor"

        strokeWidth="1.7"

        strokeLinecap="round"

        strokeLinejoin="round"

      />

      <path

        d="M8 9H8.01M8 12.5H8.01M14.5 6.5H14.51M14.5 10H14.51M14.5 13.5H14.51M17.5 6.5H17.51M17.5 10H17.51M17.5 13.5H17.51"

        stroke="currentColor"

        strokeWidth="2"

        strokeLinecap="round"

        strokeLinejoin="round"

      />

      <path

        d="M2.75 20H21.25"

        stroke="currentColor"

        strokeWidth="1.7"

        strokeLinecap="round"

      />

    </svg>

  );

}



export default function AppTopbar({ clinicName }) {

  const displayClinicName = clinicName || "Clinic workspace";



  return (

    <header className="app-topbar">

      <div className="app-topbar-left">

        <div className="clinic-chip" title={displayClinicName}>

          <div className="clinic-chip-icon-wrap">

            <BuildingIcon />

          </div>



          <div className="clinic-chip-copy">

            <span className="clinic-chip-label">Current clinic</span>

            <strong>{displayClinicName}</strong>

          </div>

        </div>

      </div>



      <div className="app-topbar-right">

        <ThemeToggle compact />

      </div>



      <style jsx>{`

        .app-topbar {

          position: sticky;

          top: 0;

          z-index: 30;

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 16px;

          min-height: 88px;

          padding: 18px 36px;

          background: rgba(245, 247, 250, 0.92);

          border-bottom: 1px solid var(--border-color, rgba(116, 136, 170, 0.2));

          backdrop-filter: blur(14px);

        }



        :global(html[data-theme="dark"]) .app-topbar {

          background: rgba(17, 24, 39, 0.84);

          border-bottom-color: rgba(148, 163, 184, 0.14);

        }



        .app-topbar-left,

        .app-topbar-right {

          display: flex;

          align-items: center;

          gap: 14px;

          min-width: 0;

        }



        .clinic-chip {

          display: inline-flex;

          align-items: center;

          gap: 12px;

          min-width: 0;

          padding: 12px 16px;

          border-radius: 18px;

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.24));

          background: rgba(255, 255, 255, 0.42);

          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);

        }



        :global(html[data-theme="dark"]) .clinic-chip {

          background: rgba(15, 23, 42, 0.34);

          border-color: rgba(148, 163, 184, 0.16);

          box-shadow: none;

        }



        .clinic-chip-icon-wrap {

          width: 40px;

          height: 40px;

          border-radius: 14px;

          flex-shrink: 0;

          display: inline-flex;

          align-items: center;

          justify-content: center;

          color: var(--text-soft, #2e3b4e);

          background: rgba(92, 118, 168, 0.08);

          border: 1px solid var(--border-color, rgba(116, 136, 170, 0.2));

        }



        .clinic-chip-icon {

          width: 19px;

          height: 19px;

        }



        .clinic-chip-copy {

          min-width: 0;

          display: flex;

          flex-direction: column;

          gap: 3px;

        }



        .clinic-chip-copy strong {

          font-size: 18px;

          line-height: 1.15;

          white-space: nowrap;

          overflow: hidden;

          text-overflow: ellipsis;

          color: var(--text-strong, #101828);

        }



        .clinic-chip-label {

          font-size: 11px;

          line-height: 1;

          letter-spacing: 0.12em;

          text-transform: uppercase;

          color: var(--muted, #66758b);

          font-weight: 700;

        }



        @media (max-width: 900px) {

          .app-topbar {

            padding: 14px 18px;

          }



          .clinic-chip {

            width: 100%;

            max-width: 100%;

          }



          .clinic-chip-copy strong {

            font-size: 16px;

          }

        }



        @media (max-width: 640px) {

          .app-topbar {

            flex-direction: column;

            align-items: stretch;

          }



          .app-topbar-right {

            justify-content: flex-start;

          }

        }

      `}</style>

    </header>

  );

}