import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function MainLayout() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
      }}
    >
      <Navbar />
      <main
        style={{
          padding: "2rem",
          flex: 1,
          width: "100%",
          boxSizing: "border-box",
          color: "var(--color-text-primary)",
        }}
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default MainLayout;
