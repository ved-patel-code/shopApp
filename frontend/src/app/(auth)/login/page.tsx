"use client";
import apiClient from "@/lib/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import axios from "axios";
import { useRouter } from "next/navigation";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 for email, 2 for OTP
  const router = useRouter();

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      await axios.post("http://127.0.0.1:8000/auth/login", { email });
      setSuccess("Login code sent! Check your email.");
      setStep(2); // Move to OTP entry step
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.detail || "Failed to send login code.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

    const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError("");
      setIsLoading(true);

      try {
        // Use the apiClient instead of the global axios
        const response = await apiClient.post("/auth/verify", { email, otp });

        // --- THIS IS THE KEY PART ---
        // Save the token to localStorage
        const { access_token } = response.data;
        localStorage.setItem("accessToken", access_token);

        // Redirect to the homepage after successful login
        router.push("/");
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response) {
          setError(err.response.data.detail || "Invalid or expired OTP.");
        } else {
          setError("An unexpected error occurred.");
        }
      } finally {
        setIsLoading(false);
      }
    };

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>
          {step === 1
            ? "Enter your email below to receive a login code"
            : "Enter the code sent to your email"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 1 ? (
          <form onSubmit={handleEmailSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 bg-red-100 p-2 rounded-md">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Login Code"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-2 text-center">
                <Label htmlFor="otp">One-Time Password</Label>
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => setOtp(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error && (
                <p className="text-sm text-red-500 bg-red-100 p-2 rounded-md">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-sm text-green-500 bg-green-100 p-2 rounded-md">
                  {success}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify & Login"}
              </Button>
            </div>
          </form>
        )}
        <div className="mt-4 text-center text-sm">
          {step === 1 ? (
            <>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="underline">
                Sign up
              </Link>
            </>
          ) : (
            <Button
              variant="link"
              onClick={() => {
                setStep(1);
                setError("");
                setSuccess("");
              }}
            >
              Use a different email
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
