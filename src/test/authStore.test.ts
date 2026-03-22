import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  return {
    ApiError,
    getCurrentUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    resendSignupOtp: vi.fn(),
    signup: vi.fn(),
    verifySignupOtp: vi.fn(),
  };
});

import { useAuthStore } from "@/stores/authStore";
import {
  login,
  logout,
  resendSignupOtp,
  signup,
  verifySignupOtp,
} from "@/lib/api";
import { resetAuthStore } from "@/test/storeTestUtils";

describe("useAuthStore", () => {
  beforeEach(() => {
    resetAuthStore();
  });

  it("stores pending signup after a successful registration", async () => {
    vi.mocked(signup).mockResolvedValue({
      email: "new.user@example.com",
      message: "OTP sent.",
    });

    const pending = await useAuthStore.getState().signup({
      name: "New User",
      email: "new.user@example.com",
      password: "password123",
    });

    expect(pending).toEqual({
      email: "new.user@example.com",
      message: "OTP sent.",
    });
    expect(useAuthStore.getState().pendingSignup).toEqual(pending);
  });

  it("verifies OTP, authenticates the user, and clears pending signup", async () => {
    resetAuthStore({
      pendingSignup: {
        email: "new.user@example.com",
        message: "OTP sent.",
      },
    });

    vi.mocked(verifySignupOtp).mockResolvedValue({
      user: {
        id: "user-1",
        email: "new.user@example.com",
        name: "New User",
      },
    });

    const user = await useAuthStore.getState().verifySignupOtp({
      email: "new.user@example.com",
      otp: "123456",
    });

    expect(user.email).toBe("new.user@example.com");
    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().pendingSignup).toBeNull();
  });

  it("surfaces a friendly login error when credentials are invalid", async () => {
    vi.mocked(login).mockRejectedValue(new Error("Invalid email or password."));

    await expect(
      useAuthStore.getState().login({
        email: "bad@example.com",
        password: "wrongpass",
      }),
    ).rejects.toThrow("Invalid email or password.");

    expect(useAuthStore.getState().user).toBeNull();
  });

  it("clears the authenticated user even when logout request fails", async () => {
    resetAuthStore({
      user: {
        id: "user-1",
        email: "member@example.com",
        name: "Member",
      },
    });

    vi.mocked(logout).mockRejectedValue(new Error("Network error"));

    await expect(useAuthStore.getState().logout()).rejects.toThrow("Network error");

    expect(useAuthStore.getState().user).toBeNull();
  });

  it("updates pending signup email when OTP is resent", async () => {
    vi.mocked(resendSignupOtp).mockResolvedValue({
      email: "new.user@example.com",
      message: "OTP sent again.",
    });

    const pending = await useAuthStore.getState().resendSignupOtp({
      email: "new.user@example.com",
    });

    expect(pending.message).toContain("again");
    expect(useAuthStore.getState().pendingSignup).toEqual(pending);
  });
});
