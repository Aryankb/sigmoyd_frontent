import { ClerkProvider, SignedIn, SignedOut ,SignIn} from "@clerk/clerk-react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import MainLayout from "../src/components/MainLayout";
import CreateToolPage from "./components/CreateToolPage";
import ApiKeyModal from "./components/ApiKeyModal";
import ManageAuth from "./components/ManageAuth";
import ShootingStarsAndStarsBackgroundDemo from "./components/ui/shooting-stars-and-stars-background-demo";
import CustomSignInForm from "./components/ui/custom-signin-form";
import { useState } from "react";

const CLERK_PUBLISHABLE_KEY =
  "pk_test_bWludC1kaW5vc2F1ci01NC5jbGVyay5hY2NvdW50cy5kZXYk";

function App() {
  // Toggle to switch between custom and Clerk UI (for development)
  const [useCustomUI, setUseCustomUI] = useState(true);

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <Router>
        <SignedOut>
          <div className="min-h-screen flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,173,181,0.15)_0%,rgba(9,9,11,0)_70%)]" />
              <ShootingStarsAndStarsBackgroundDemo />
            </div>

            <div className="relative z-10">
              {useCustomUI ? (
                <CustomSignInForm />
              ) : (
                <SignIn
                  appearance={{
                    layout: {
                      logoPlacement: "none",
                      socialButtonsVariant: "iconButton",
                    },
                    variables: {
                      colorPrimary: "white",
                      colorBackground: "rgba(0, 0, 0, 0.8)",
                      colorText: "white",
                      colorTextSecondary: "white",
                      colorInputBackground: "rgba(30, 30, 30, 0.8)",
                      colorInputBorder: "#00ADB5",
                      colorButtonText: "white",
                    },
                    elements: {
                      card: {
                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                        border: "2px solid #00ADB5",
                        borderRadius: "15px",
                        boxShadow: "0px 0px 20px rgba(0, 173, 181, 0.6)",
                      },
                      headerTitle: {
                        color: "white",
                        fontSize: "24px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        fontFamily: "'Inter', sans-serif",
                      },
                      formFieldInput: {
                        backgroundColor: "rgba(30, 30, 30, 0.8)",
                        color: "white",
                        borderColor: "#00ADB5",
                        fontFamily: "'Inter', sans-serif",
                      },
                      formButtonPrimary: {
                        backgroundColor: "#00ADB5",
                        color: "black",
                        fontWeight: "bold",
                        fontFamily: "'Inter', sans-serif",
                        textTransform: "uppercase",
                      },
                      footer: {
                        backgroundColor: "rgba(0, 0, 0, 0)",
                        letterSpacing: "2px",
                      },
                    },
                  }}
                />
              )}

              {/* Dev button to toggle between UI versions */}
              <button
                onClick={() => setUseCustomUI(!useCustomUI)}
                className="absolute bottom-4 right-4 text-xs text-gray-500 hover:text-gray-300"
              >
                Switch to {useCustomUI ? "Clerk" : "Custom"} UI
              </button>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          <Routes>
            <Route path="/*" element={<MainLayoutWithAuthCheck />} />
            <Route path="/create-tool" element={<CreateToolPage />} />
            <Route path="/api-keys" element={<ManageAuth />} />
            <Route path="/manage-auths" element={<ManageAuth />} />
          </Routes>
        </SignedIn>
      </Router>
    </ClerkProvider>
  );
}

// ✅ Move useAuth inside a child component
import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
function MainLayoutWithAuthCheck() {
  const { getToken } = useAuth();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const token = await getToken();
        const response = await fetch("http://localhost:8000/checkuser", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        console.log("User Check Response:", data);
      } catch (error) {
        console.error("Error checking user:", error);
      }
    };

    checkUser();
  }, [getToken]);

  return <MainLayout />;
}

export default App;
