import nodemailer from "nodemailer";
type MailTransporter = ReturnType<typeof nodemailer.createTransport>;

import { env } from "../../../config/env.js";
import { logger } from "../../../shared/logger.js";

let cachedTransporter: MailTransporter | null = null;

export function getMailTransporter(): MailTransporter | null {
  if (cachedTransporter) return cachedTransporter;
  if (!env.SMTP_HOST) {
    return null;
  }
  try {
    cachedTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE ?? false,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS.replace(/\s+/g, ""),
            }
          : undefined,
    });
    return cachedTransporter;
  } catch (err) {
    logger.error({ err }, "[MAILER] Could not initialize nodemailer transporter");
    return null;
  }
}

export type AdminRegistrationNotificationInput = {
  requestId: string;
  referenceCode: string;
  fullName: string;
  email: string;
  organizationCode: string;
  organizationName: string;
  department: string;
  designation: string;
  requestedResponsibility: string;
  registeredAt?: Date;
  reviewUrl?: string;
};

export type UserApprovalNotificationInput = {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  roleName: string;
  loginUrl?: string;
};

export type UserRejectionNotificationInput = {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  rejectionReason?: string;
};

function resolveAdminRecipients(): string[] {
  const configured = env.ADMIN_APPROVAL_EMAIL?.trim();
  const primaryFallback = "divejuthe@gmail.com";
  const recipients = new Set<string>();

  if (configured) {
    recipients.add(configured.toLowerCase());
  }
  // Ensure the primary designated admin email is always included
  recipients.add(primaryFallback.toLowerCase());

  return Array.from(recipients);
}

function emailBrandHeader(): string {
  return `
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px; border-radius: 8px 8px 0 0; text-align: left; border-bottom: 3px solid #ff5b00;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td>
            <div style="display: inline-block; vertical-align: middle;">
              <span style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
                INFRA<span style="color: #ff5b00;">OS</span>
              </span>
              <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-top: 2px;">
                National Infrastructure Intelligence & Coordination Platform
              </div>
            </div>
          </td>
          <td align="right">
            <span style="display: inline-block; background: rgba(255, 91, 0, 0.15); border: 1px solid rgba(255, 91, 0, 0.4); color: #ff914d; font-family: monospace; font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
              Statutory Clearance
            </span>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function emailBrandFooter(): string {
  return `
    <div style="background: #f8fafc; padding: 20px 24px; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; font-size: 12px; color: #64748b; line-height: 1.6;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #334155;">
        InfraOS Civic Atlas & Sovereign Operations Hub
      </p>
      <p style="margin: 0 0 8px 0;">
        This is an automated institutional notification dispatched under strict role-based access security protocols. Passwords and credentials are cryptographically protected and never transmitted in notifications.
      </p>
      <p style="margin: 0; color: #94a3b8; font-size: 11px;">
        &copy; ${new Date().getFullYear()} Democratic Socialist Republic of Sri Lanka · Ministry of Transport & Highways · All Rights Reserved.
      </p>
    </div>
  `;
}

export async function sendAdminRegistrationNotification(
  input: AdminRegistrationNotificationInput,
): Promise<{ dispatched: boolean; recipients: string[]; simulation: boolean }> {
  const recipients = resolveAdminRecipients();
  const defaultReviewUrl = `${env.FRONTEND_ORIGIN}/admin/registrations?id=${input.requestId}`;
  const reviewUrl = input.reviewUrl ?? defaultReviewUrl;
  const registeredTime = (input.registeredAt ?? new Date()).toUTCString();

  const subject = `[InfraOS Approval Required] New Officer Registration: ${input.fullName} (${input.organizationCode})`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">
        <table align="center" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td>
              ${emailBrandHeader()}
              
              <div style="padding: 28px 24px;">
                <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
                  <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #b45309; display: block; margin-bottom: 2px;">
                    Action Required · Pending Administrator Approval
                  </span>
                  <span style="font-size: 14px; color: #92400e;">
                    A new institutional user account has been registered and is pending verification and role assignment.
                  </span>
                </div>

                <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">
                  Applicant Dossier Summary
                </h2>

                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 12px; color: #64748b; font-weight: 600; width: 38%;">Reference Code</td>
                    <td style="padding: 10px 12px; color: #0f172a; font-family: monospace; font-weight: 700;">${input.referenceCode}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
                    <td style="padding: 10px 12px; color: #64748b; font-weight: 600;">Full Name</td>
                    <td style="padding: 10px 12px; color: #0f172a; font-weight: 700;">${input.fullName}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 12px; color: #64748b; font-weight: 600;">Official Work Email</td>
                    <td style="padding: 10px 12px; color: #0284c7; font-weight: 600;">${input.email}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
                    <td style="padding: 10px 12px; color: #64748b; font-weight: 600;">Institution / Authority</td>
                    <td style="padding: 10px 12px; color: #0f172a;">${input.organizationName} (${input.organizationCode})</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 12px; color: #64748b; font-weight: 600;">Division / Department</td>
                    <td style="padding: 10px 12px; color: #0f172a;">${input.department}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
                    <td style="padding: 10px 12px; color: #64748b; font-weight: 600;">Designation</td>
                    <td style="padding: 10px 12px; color: #0f172a;">${input.designation}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 12px; color: #64748b; font-weight: 600;">Requested Responsibility</td>
                    <td style="padding: 10px 12px; color: #b45309; font-weight: 600;">${input.requestedResponsibility}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
                    <td style="padding: 10px 12px; color: #64748b; font-weight: 600;">Registered At</td>
                    <td style="padding: 10px 12px; color: #64748b; font-size: 13px;">${registeredTime}</td>
                  </tr>
                </table>

                <div style="text-align: center; margin: 32px 0 20px 0;">
                  <a href="${reviewUrl}" target="_blank" style="display: inline-block; background-color: #ff5b00; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px; box-shadow: 0 4px 6px -1px rgba(255, 91, 0, 0.3);">
                    Review &amp; Approve Request &rarr;
                  </a>
                </div>

                <p style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 0;">
                  Administrator authentication is required to access the review terminal. Link: <br />
                  <a href="${reviewUrl}" style="color: #ff5b00; word-break: break-all;">${reviewUrl}</a>
                </p>
              </div>

              ${emailBrandFooter()}
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = `
INFRAOS - National Infrastructure Intelligence & Coordination Platform
ACTION REQUIRED: PENDING ADMINISTRATOR APPROVAL

A new institutional officer has registered an account and is awaiting verification:

- Reference Code: ${input.referenceCode}
- Full Name: ${input.fullName}
- Email: ${input.email}
- Organization: ${input.organizationName} (${input.organizationCode})
- Department: ${input.department}
- Designation: ${input.designation}
- Requested Responsibility: ${input.requestedResponsibility}
- Registration Date: ${registeredTime}

Review and approve or reject this request securely at:
${reviewUrl}

(Administrator sign-in is required. Passwords are encrypted with bcrypt and never sent.)
  `.trim();

  const transporter = getMailTransporter();
  const fromAddress = env.SMTP_FROM ?? "InfraOS Platform <notifications@infraos.gov.lk>";

  if (!transporter) {
    logger.info(
      {
        to: recipients,
        subject,
        referenceCode: input.referenceCode,
        reviewUrl,
        mode: "SIMULATION_FALLBACK",
      },
      "[MAILER] No SMTP server configured. Admin registration notification logged in simulation mode.",
    );
    return { dispatched: false, recipients, simulation: true };
  }

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: recipients.join(", "),
      subject,
      html,
      text,
    });
    logger.info(
      {
        to: recipients,
        referenceCode: input.referenceCode,
        subject,
      },
      "[MAILER] Admin registration notification dispatched successfully via SMTP.",
    );
    return { dispatched: true, recipients, simulation: false };
  } catch (error) {
    logger.error(
      {
        error,
        to: recipients,
        referenceCode: input.referenceCode,
      },
      "[MAILER] Failed to deliver admin registration email via SMTP.",
    );
    return { dispatched: false, recipients, simulation: false };
  }
}

export async function sendUserRegistrationApprovedNotification(
  input: UserApprovalNotificationInput,
): Promise<{ dispatched: boolean; simulation: boolean }> {
  const loginUrl = input.loginUrl ?? `${env.FRONTEND_ORIGIN}/auth/login`;
  const subject = `[InfraOS] Account Approved — Access Granted to ${input.organizationName}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">
        <table align="center" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
          <tr>
            <td>
              ${emailBrandHeader()}
              
              <div style="padding: 28px 24px;">
                <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
                  <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #047857; display: block; margin-bottom: 2px;">
                    Account Approved &amp; Activated
                  </span>
                  <span style="font-size: 14px; color: #065f46;">
                    Your institutional InfraOS account request has been reviewed and approved by the Super Administrator.
                  </span>
                </div>

                <p style="font-size: 15px; color: #1e293b; line-height: 1.6; margin: 0 0 16px 0;">
                  Dear <strong>${input.recipientName}</strong>,
                </p>

                <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                  Your account for <strong>${input.organizationName}</strong> has been granted authorization with the role of <strong>${input.roleName}</strong>. You can now sign in using your registered email and password.
                </p>

                <div style="text-align: center; margin: 32px 0 24px 0;">
                  <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: #ff5b00; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 6px; font-weight: 700; font-size: 15px;">
                    Sign In to InfraOS &rarr;
                  </a>
                </div>

                <p style="font-size: 12px; color: #64748b; text-align: center;">
                  Direct login URL: <a href="${loginUrl}" style="color: #ff5b00;">${loginUrl}</a>
                </p>
              </div>

              ${emailBrandFooter()}
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = `
INFRAOS - National Infrastructure Intelligence & Coordination Platform
ACCOUNT APPROVED & ACTIVATED

Dear ${input.recipientName},

Your institutional account for ${input.organizationName} has been approved with the role of ${input.roleName}.
You can now sign in using your registered email address and password at:

${loginUrl}
  `.trim();

  const transporter = getMailTransporter();
  const fromAddress = env.SMTP_FROM ?? "InfraOS Platform <notifications@infraos.gov.lk>";

  if (!transporter) {
    logger.info(
      {
        to: input.recipientEmail,
        subject,
        mode: "SIMULATION_FALLBACK",
      },
      "[MAILER] No SMTP configured. User approval notification logged in simulation mode.",
    );
    return { dispatched: false, simulation: true };
  }

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: input.recipientEmail,
      subject,
      html,
      text,
    });
    logger.info(
      { to: input.recipientEmail, subject },
      "[MAILER] User approval notification dispatched via SMTP.",
    );
    return { dispatched: true, simulation: false };
  } catch (error) {
    logger.error(
      { error, to: input.recipientEmail },
      "[MAILER] Failed to deliver user approval email via SMTP.",
    );
    return { dispatched: false, simulation: false };
  }
}

export async function sendUserRegistrationRejectedNotification(
  input: UserRejectionNotificationInput,
): Promise<{ dispatched: boolean; simulation: boolean }> {
  const subject = `[InfraOS] Update regarding your registration request`;
  const reasonText = input.rejectionReason?.trim()
    ? input.rejectionReason
    : "Institutional verification could not be completed with the provided credentials.";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">
        <table align="center" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
          <tr>
            <td>
              ${emailBrandHeader()}
              
              <div style="padding: 28px 24px;">
                <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
                  <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #b91c1c; display: block; margin-bottom: 2px;">
                    Registration Status Update
                  </span>
                  <span style="font-size: 14px; color: #991b1b;">
                    Your account registration request has been reviewed and declined.
                  </span>
                </div>

                <p style="font-size: 15px; color: #1e293b; line-height: 1.6; margin: 0 0 16px 0;">
                  Dear <strong>${input.recipientName}</strong>,
                </p>

                <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
                  Thank you for submitting your institutional account request for <strong>${input.organizationName}</strong>. Following administrative review, we regret to inform you that your request could not be approved at this time.
                </p>

                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
                  <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">
                    Administrative Notice
                  </div>
                  <div style="font-size: 14px; color: #0f172a;">
                    ${reasonText}
                  </div>
                </div>

                <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0;">
                  If you believe this decision was made in error, please contact your ministry or departmental coordinator, or submit a new request ensuring that official credentials and authorized domains are utilized.
                </p>
              </div>

              ${emailBrandFooter()}
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = `
INFRAOS - National Infrastructure Intelligence & Coordination Platform
REGISTRATION STATUS UPDATE

Dear ${input.recipientName},

Following administrative review, your institutional registration request for ${input.organizationName} could not be approved at this time.

Reason / Administrative Notice:
${reasonText}

If you believe this decision was made in error, please contact your agency administrator or coordinator.
  `.trim();

  const transporter = getMailTransporter();
  const fromAddress = env.SMTP_FROM ?? "InfraOS Platform <notifications@infraos.gov.lk>";

  if (!transporter) {
    logger.info(
      {
        to: input.recipientEmail,
        subject,
        mode: "SIMULATION_FALLBACK",
      },
      "[MAILER] No SMTP configured. User rejection notification logged in simulation mode.",
    );
    return { dispatched: false, simulation: true };
  }

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: input.recipientEmail,
      subject,
      html,
      text,
    });
    logger.info(
      { to: input.recipientEmail, subject },
      "[MAILER] User rejection notification dispatched via SMTP.",
    );
    return { dispatched: true, simulation: false };
  } catch (error) {
    logger.error(
      { error, to: input.recipientEmail },
      "[MAILER] Failed to deliver user rejection email via SMTP.",
    );
    return { dispatched: false, simulation: false };
  }
}
