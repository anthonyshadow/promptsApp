import { useEffect, useState } from "react";
import "./globalStyles";
import AdminRouteTree from "./admin/AdminRouteTree";
import PublicShell from "./public/PublicShell";

function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    function syncPath() {
      setPath(window.location.pathname);
    }

    window.addEventListener("popstate", syncPath);

    return () => {
      window.removeEventListener("popstate", syncPath);
    };
  }, []);

  function navigate(pathname: string) {
    window.history.pushState(null, "", pathname);
    setPath(window.location.pathname);
  }

  if (path.startsWith("/__admin")) {
    return <AdminRouteTree />;
  }

  return <PublicShell path={path} onNavigate={navigate} />;
}

export default App;
