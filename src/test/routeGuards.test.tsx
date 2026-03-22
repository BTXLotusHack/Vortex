import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/auth/RouteGuards";
import { resetAuthStore } from "@/test/storeTestUtils";

describe("RouteGuards", () => {
  it("redirects unauthenticated users from protected routes to login", () => {
    resetAuthStore({ user: null, isLoading: false });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Page")).not.toBeInTheDocument();
  });

  it("renders protected content for authenticated users", () => {
    resetAuthStore({
      user: {
        id: "user-1",
        email: "member@example.com",
        name: "Member",
      },
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
  });

  it("redirects authenticated users away from public-only routes", () => {
    resetAuthStore({
      user: {
        id: "user-1",
        email: "member@example.com",
        name: "Member",
      },
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Login Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });
});
