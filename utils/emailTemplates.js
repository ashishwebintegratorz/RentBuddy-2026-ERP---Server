const getTemplate = (type, data) => {
  const { name, amount, dueDate, payLink, status } = data;

  // Brand Colors
  const colors = {
    primary: "#f24e6c", // Updated Primary Color
    danger: "#DC2626", // Red for overdue
    warning: "#F59E0B", // Orange for grace
    success: "#10B981", // Green for active
    bg: "#F3F4F6",
    white: "#FFFFFF",
    text: "#1F2937",
    gray: "#6B7280"
  };

  let themeColor = colors.primary;
  let title = "Subscription Update";
  let statusText = "";

  switch (type) {
    case 'DUE':
      themeColor = colors.primary;
      title = "Payment Due Today";
      statusText = "Payment Due";
      break;
    case 'GRACE':
      themeColor = colors.warning;
      title = "Payment Grace Period";
      statusText = "Action Required";
      break;
    case 'STRICT':
      themeColor = colors.danger;
      title = "Service Interruption Alert";
      statusText = "Immediate Action Required";
      break;
    case 'MANUAL_SKIP':
      themeColor = colors.success;
      title = "Payment Adjusted";
      statusText = "Resolved";
      break;
    case 'REFUND':
      themeColor = colors.success;
      title = "Refund Processed Successfully";
      statusText = "Refund Completed";
      break;
    case 'TEST_CLARIFICATION':
      themeColor = colors.primary;
      title = "Clarification Regarding Recurring Payment Email";
      statusText = "Update";
      break;
  }

  // Format amount safely
  const formattedAmount = amount ? (amount / 100).toFixed(2) : "0.00";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.bg}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${colors.bg}; padding: 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: ${colors.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 40px 0 20px 0; background-color: ${colors.white};">
              <!-- Logo Placeholder -->
              <h1 style="margin: 0; color: ${colors.text}; font-size: 24px; font-weight: 800; letter-spacing: -1px;">Rent<span style="color: ${colors.primary};">Buddy</span></h1>
            </td>
          </tr>

          <!-- Status Banner -->
          <tr>
            <td align="center" style="padding: 0 40px;">
              <div style="background-color: ${themeColor}15; border: 1px solid ${themeColor}40; border-radius: 8px; padding: 12px; display: inline-block;">
                <span style="color: ${themeColor}; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">${statusText}</span>
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: ${colors.text}; font-size: 20px; font-weight: 600;">Hello ${name || 'Subscriber'},</h2>
              
              ${type === 'TEST_CLARIFICATION' ? `
                <p style="margin: 0 0 20px 0; color: ${colors.gray}; line-height: 1.6; font-size: 16px;">
                  I hope you are doing well.
                </p>
                <p style="margin: 0 0 20px 0; color: ${colors.gray}; line-height: 1.6; font-size: 16px;">
                  I wanted to inform you that the recent email you received regarding the recurring payment due was part of a test process. Please note that no actual payment is required from your end at this time.
                </p>
                <p style="margin: 0 0 20px 0; color: ${colors.gray}; line-height: 1.6; font-size: 16px;">
                  Kindly ignore the payment request email. We apologize for any confusion or inconvenience this may have caused.
                </p>
                <p style="margin: 0 0 24px 0; color: ${colors.gray}; line-height: 1.6; font-size: 16px;">
                  If you have any questions or concerns, please feel free to reach out.
                </p>
              ` : type === 'MANUAL_SKIP' ? `
                <p style="margin: 0 0 24px 0; color: ${colors.gray}; line-height: 1.6; font-size: 16px;">
                  Your subscription payment for this month has been manually adjusted by our team. No further action is required from you at this time.
                </p>
              ` : type === 'REFUND' ? `
                <p style="margin: 0 0 24px 0; color: ${colors.gray}; line-height: 1.6; font-size: 16px;">
                  A refund has been successfully processed for your recent payment. Please find the details below.
                </p>

                <!-- Details Box -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${colors.bg}; border-radius: 8px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="color: ${colors.gray}; font-size: 14px; padding-bottom: 8px;">Refunded Amount</td>
                          <td align="right" style="color: ${colors.text}; font-size: 14px; font-weight: 600; padding-bottom: 8px;">₹${formattedAmount}</td>
                        </tr>
                        <tr>
                          <td style="color: ${colors.gray}; font-size: 14px;">Status</td>
                          <td align="right" style="color: ${colors.success}; font-size: 14px; font-weight: 600;">${statusText}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              ` : `
                <p style="margin: 0 0 24px 0; color: ${colors.gray}; line-height: 1.6; font-size: 16px;">
                  This is a reminder regarding your subscription payment. To avoid any service interruptions, please clear your dues using the link below.
                </p>

                <!-- Details Box -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${colors.bg}; border-radius: 8px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="color: ${colors.gray}; font-size: 14px; padding-bottom: 8px;">Amount Due</td>
                          <td align="right" style="color: ${colors.text}; font-size: 14px; font-weight: 600; padding-bottom: 8px;">₹${formattedAmount}</td>
                        </tr>
                        <tr>
                          <td style="color: ${colors.gray}; font-size: 14px;">Due Date</td>
                          <td align="right" style="color: ${colors.text}; font-size: 14px; font-weight: 600;">${dueDate || 'Today'}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Action Button -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center">
                      <a href="${payLink}" target="_blank" style="display: inline-block; background-color: ${colors.primary}; color: ${colors.white}; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">Pay Now</a>
                    </td>
                  </tr>
                  <!-- Fallback Link -->
                  <tr>
                    <td align="center" style="padding-top: 20px;">
                      <p style="margin: 0; color: ${colors.gray}; font-size: 12px;">
                        Link not working? Copy and paste this URL:<br>
                        <a href="${payLink}" style="color: ${colors.primary}; word-break: break-all;">${payLink}</a>
                      </p>
                    </td>
                  </tr>
                </table>
              `}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: ${colors.bg}; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0 0 10px 0; color: ${colors.gray}; font-size: 12px; text-align: center;">
                Need help? Reply to this email or contact support.
              </p>
              <p style="margin: 0; color: ${colors.gray}; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} Rentbuddy. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

module.exports = { getTemplate };
