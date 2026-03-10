import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <section>
      <h1>404 - Page Not Found</h1>
      <p>The page you requested does not exist in the current route structure.</p>
      <Link to="/" style={{ color: "#101828", fontWeight: 700 }}>
        Return to home
      </Link>
    </section>
  );
}

export default NotFoundPage;
