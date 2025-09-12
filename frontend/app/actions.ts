"use server";

import { encodedRedirect } from "@/utils/navigation-utils";
import { redirect } from "next/navigation";
import { hashPasswordForAuth } from "@/utils/cryptography/encryption";
import { getBackend } from "@/utils/api/backend-interface";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required",
    );
  }

  try {
    const backend = getBackend();
    const { error } = await backend.auth.signUp({
      email,
      password,
      emailRedirectTo: `/auth/callback`,
    });

    if (error) {
      console.error("Sign up error:", error);
      return encodedRedirect("error", "/sign-up", error);
    } else {
      return encodedRedirect(
        "success",
        "/sign-up",
        "Thanks for signing up! Please check your email for a verification link.",
      );
    }
  } catch (error) {
    console.error("Sign up error:", error);
    return encodedRedirect("error", "/sign-up", "An error occurred during sign up");
  }
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const backend = getBackend();
    const { error } = await backend.auth.signIn({
      email,
      password,
    });

    if (error) {
      return encodedRedirect("error", "/sign-in", error);
    }

    return redirect("/dashboard");
  } catch (error) {
    console.error("Sign in error:", error);
    return encodedRedirect("error", "/sign-in", "An error occurred during sign in");
  }
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  try {
    const backend = getBackend();
    const { error } = await backend.auth.resetPasswordForEmail({
      email,
      redirectTo: `/auth/callback?redirect_to=/dashboard/reset-password`,
    });

    if (error) {
      console.error("Reset password error:", error);
      return encodedRedirect(
        "error",
        "/forgot-password",
        "Could not reset password",
      );
    }

    if (callbackUrl) {
      return redirect(callbackUrl);
    }

    return encodedRedirect(
      "success",
      "/forgot-password",
      "Check your email for a link to reset your password.",
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return encodedRedirect("error", "/forgot-password", "An error occurred while resetting password");
  }
};

export const resetPasswordAction = async (formData: FormData) => {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match",
    );
  }

  // Hash the new password for authentication
  const authHash = hashPasswordForAuth(password);

  try {
    const backend = getBackend();
    const { error } = await backend.auth.updatePassword({
      password: authHash,
    });

    if (error) {
      return encodedRedirect(
        "error",
        "/dashboard/reset-password",
        "Password update failed",
      );
    }

    return encodedRedirect("success", "/dashboard/reset-password", "Password updated");
  } catch (error) {
    console.error("Update password error:", error);
    return encodedRedirect("error", "/dashboard/reset-password", "An error occurred while updating password");
  }
};

export const signOutAction = async () => {
  try {
    const backend = getBackend();
    await backend.auth.signOut();

    // Note: Cookie clearing will be handled on the client side
    // since we can't directly manipulate cookies in server actions
    return redirect("/sign-in");
  } catch (error) {
    console.error("Sign out error:", error);
    return redirect("/sign-in"); // Still redirect even if sign out fails
  }
};
