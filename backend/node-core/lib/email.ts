import nodemailer from "nodemailer";

const requiredEnvVars = [
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USER",
  "EMAIL_PASS",
  "EMAIL_FROM",
] as const;

function getTransporter() {
  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables for email: ${missingEnvVars.join(", ")}`
    );
  }
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT!, 10),
    secure: parseInt(process.env.EMAIL_PORT!, 10) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Sends a One-Time Password (OTP) email to a specified recipient.
 * @param to The recipient's email address.
 * @param otp The 6-digit code to be sent.
 */
export async function sendOTPEmail(to: string, otp: string) {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME || "Your App"}" <${
        process.env.EMAIL_FROM
      }>`,
      to: to,
      subject: "Your Password Reset Code",
      text: `Your One-Time Password (OTP) for resetting your password is: ${otp}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>We received a request to reset your password. Use the code below to complete the process.</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
            ${otp}
          </p>
          <p>This code will expire in 10 minutes. If you did not request a password reset, please ignore this email.</p>
        </div>
      `,
    });

    console.log("Message sent successfully: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);

    throw new Error("Failed to send the password reset email.");
  }
}