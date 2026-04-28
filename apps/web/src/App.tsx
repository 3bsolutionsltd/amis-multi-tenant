import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import StagingBanner from "./components/StagingBanner";

export default function App() {
  const isStaging = import.meta.env.VITE_APP_ENV === "staging";
  return (
    <>
      <StagingBanner />
      <div style={isStaging ? { paddingTop: "33px" } : undefined}>
        <RouterProvider router={router} />
      </div>
    </>
  );
}
