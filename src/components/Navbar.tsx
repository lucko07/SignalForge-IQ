import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Pricing", to: "/pricing" },
  { label: "Signals", to: "/signals" },
  { label: "Education", to: "/education" },
  { label: "FAQ", to: "/faq" },
  { label: "Contact", to: "/contact" },
  { label: "Login", to: "/login" },
  { label: "Signup", to: "/signup" },
];

function Navbar() {
  return (
    <header
      style={{
        borderBottom: "1px solid #d6d9e0",
        backgroundColor: "#ffffff",
        position: "sticky",
        top: 0,
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <NavLink
          to="/"
          style={{
            textDecoration: "none",
            color: "#101828",
            fontSize: "1.25rem",
            fontWeight: 700,
          }}
        >
          SignalForge IQ
        </NavLink>

        <nav
          aria-label="Primary"
          style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                textDecoration: "none",
                color: isActive ? "#ffffff" : "#344054",
                backgroundColor: isActive ? "#101828" : "#f2f4f7",
                padding: "0.55rem 0.9rem",
                borderRadius: "999px",
                fontSize: "0.95rem",
                fontWeight: 600,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
