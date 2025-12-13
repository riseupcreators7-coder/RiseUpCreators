import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // Use TLS, not SSL
  requireTLS: true, // Force TLS encryption
  auth: {
    user: process.env.SMTP_USER || "noreply@example.com",
    pass: process.env.SMTP_PASS || "defaultpass"
  },
  // Add connection timeout and debug options
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 60000,
  debug: process.env.NODE_ENV === 'development'
});

// Log configuration on startup


// Generic email sending function
export const sendEmail = async (to: string, subject: string, html: string, from?: string) => {
  try {
    const mailOptions = {
      from: from || process.env.MAIL_FROM || "stg.violin@gmail.com",
      to,
      subject,
      html
    };

    const result = await transporter.sendMail(mailOptions);
    
    return result;
  } catch (error: any) {
    
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

export const sendWelcomeEmail = async (email: string, name: string, role: string) => {
  const mailOptions = {
    from: process.env.MAIL_FROM || "stg.violin@gmail.com",
    to: email,
    subject: `Welcome to Rise Up Creators!`,
    html: `
      <div style="background: #000; color: #fff; padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: #FF3C2A;">Welcome to Rise Up Creators!</h1>
        <p>Hi ${name},</p>
        <p>Thank you for joining Rise Up Creators as ${role === 'artist' ? 'an artist' : 'a fan'}!</p>
        ${role === 'artist' ? 
          '<p>You can now upload your music, create events, sell merch, and connect with your fans.</p>' :
          '<p>Discover amazing music, follow your favorite artists, and enjoy exclusive content.</p>'
        }
        <p>Get started by exploring the platform.</p>
        <p>Best regards,<br>The Rise Up Creators Team</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  try {
    const mailOptions = {
      from: process.env.MAIL_FROM || "stg.violin@gmail.com",
      to: email,
      subject: "Reset Your Password - Rise Up Creators",
      html: `
        <div style="background: #000; color: #fff; padding: 20px; font-family: Arial, sans-serif;">
          <h1 style="color: #FF3C2A;">Reset Your Password</h1>
          <p>You requested a password reset. Use the code below:</p>
          <div style="background: #1a1a1a; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #FF3C2A; margin: 0; text-align: center;">${resetToken}</h2>
          </div>
          <p>This code expires in 15 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    
    return result;
  } catch (error: any) {
    
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

export const sendOrderConfirmation = async (email: string, orderDetails: any) => {
  // Generate a display-friendly order ID (fixing the undefined issue)
  const orderId = orderDetails._id ? orderDetails._id.toString().slice(-8).toUpperCase() : orderDetails.id || 'N/A';
  
  // Format order date & time
  const orderDate = orderDetails.createdAt ? new Date(orderDetails.createdAt).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'N/A';

  // Generate items list HTML with images, names, size/color, quantity and prices
  const itemsHtml = orderDetails.items ? orderDetails.items.map((item: any) => `
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 10px; display: flex; align-items: center;">
        ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 10px;">` : ''}
        <div>
          <strong>${item.name || 'Item'}</strong>
          ${item.size ? `<br><small style="color: #ccc;">Size: ${item.size}</small>` : ''}
          ${item.color ? `<br><small style="color: #ccc;">Color: ${item.color}</small>` : ''}
        </div>
      </td>
      <td style="text-align: center; padding: 10px;">${item.qty}</td>
      <td style="text-align: right; padding: 10px;">₹${item.unitPrice}</td>
      <td style="text-align: right; padding: 10px;"><strong>₹${item.qty * item.unitPrice}</strong></td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="text-align: center; padding: 20px;">No items found</td></tr>';

  // Calculate subtotal and discount
  const subtotal = orderDetails.items ? orderDetails.items.reduce((sum: number, item: any) => sum + (item.qty * item.unitPrice), 0) : 0;
  const discount = orderDetails.discount || 0;

  // Delivery information for physical items
  const deliveryInfo = orderDetails.shippingAddress ? `
    <div style="background: #1a1a1a; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #FF3C2A; margin-top: 0;">📦 Delivery Address</h3>
      <p style="margin: 5px 0;"><strong>${orderDetails.shippingAddress.name}</strong></p>
      <p style="margin: 5px 0;">${orderDetails.shippingAddress.address}</p>
      <p style="margin: 5px 0;">${orderDetails.shippingAddress.city}, ${orderDetails.shippingAddress.state} - ${orderDetails.shippingAddress.pincode}</p>
      <p style="margin: 5px 0;">📞 ${orderDetails.shippingAddress.phone}</p>
      <p style="color: #4CAF50; margin: 10px 0;">📧 We'll send you email updates as your order progresses!</p>
    </div>
  ` : '';

  const mailOptions = {
    from: process.env.MAIL_FROM || "stg.violin@gmail.com",
    to: email,
    subject: `🎉 Order Confirmation #${orderId} - Rise Up Creators`,
    html: `
      <div style="background: #000; color: #fff; padding: 20px; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <!-- Header with emojis and professional design -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #FF3C2A; margin: 0;">🎉 Order Confirmed!</h1>
          <p style="color: #ccc; margin: 10px 0;">Thank you for your purchase from Rise Up Creators</p>
        </div>

        <!-- Order Details Section -->
        <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #FF3C2A; margin-top: 0;">📋 Order Details</h2>
          <table style="width: 100%;">
            <tr>
              <td><strong>Order Number:</strong></td>
              <td style="text-align: right; color: #FF3C2A;">#${orderId}</td>
            </tr>
            <tr>
              <td><strong>Order Date & Time:</strong></td>
              <td style="text-align: right;">${orderDate}</td>
            </tr>
            <tr>
              <td><strong>Order Type:</strong></td>
              <td style="text-align: right;">${orderDetails.type || 'MERCH'}</td>
            </tr>
          </table>
        </div>

        <!-- Detailed Items List with images, names, size/color, quantity and prices -->
        <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #FF3C2A; margin-top: 0;">🛍️ Items Ordered</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="color: #FF3C2A; border-bottom: 2px solid #FF3C2A;">
                <th style="text-align: left; padding: 10px;">Item</th>
                <th style="text-align: center; padding: 10px;">Qty</th>
                <th style="text-align: right; padding: 10px;">Price</th>
                <th style="text-align: right; padding: 10px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <!-- Complete Pricing Breakdown -->
        <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #FF3C2A; margin-top: 0;">💰 Pricing Details</h3>
          <table style="width: 100%;">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right;">₹${subtotal}</td>
            </tr>
            ${discount > 0 ? `<tr><td>Discount Applied:</td><td style="text-align: right; color: #4CAF50;">-₹${discount}</td></tr>` : ''}
            <tr style="border-top: 1px solid #333; font-size: 18px; font-weight: bold;">
              <td style="padding-top: 10px;">Final Total:</td>
              <td style="text-align: right; padding-top: 10px; color: #FF3C2A;">₹${orderDetails.totalAmount}</td>
            </tr>
          </table>
        </div>

        <!-- Payment Information -->
        <div style="background: #1a1a1a; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #FF3C2A; margin-top: 0;">💳 Payment Information</h3>
          <p style="margin: 5px 0;"><strong>Payment ID:</strong> ${orderDetails.razorpayPaymentId || 'Processing...'}</p>
          <p style="margin: 5px 0;"><strong>Payment Status:</strong> <span style="color: #4CAF50;">${orderDetails.status}</span></p>
          <p style="margin: 5px 0;"><strong>Payment Method:</strong> Online Payment</p>
          ${orderDetails.appliedPromoCode ? `<p style="margin: 5px 0;"><strong>Applied Promo Code:</strong> ${orderDetails.appliedPromoCode}</p>` : ''}
        </div>

        ${deliveryInfo}

        <!-- Professional Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
          <p style="color: #ccc;">📞 Need help? Contact us at support@riseupcreators.com</p>
          <p style="color: #ccc; font-size: 12px;">© 2024 Rise Up Creators. All rights reserved.</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

export const sendTicketEmail = async (email: string, ticketDetails: any, qrCode: string) => {
  const tickets = ticketDetails.tickets || [{ ticketNumber: ticketDetails.ticketId, qrCode }];
  
  const ticketHTML = tickets.map((ticket: any, index: number) => `
    <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 10px 0; border: 2px solid #FF3C2A;">
      <h3 style="color: #FF3C2A; margin: 0 0 15px 0;">Ticket ${index + 1} of ${tickets.length}</h3>
      <div style="text-align: center; margin: 15px 0;">
        <img src="${ticket.qrCode || qrCode}" alt="Ticket QR Code" style="max-width: 200px; border: 2px solid #333; border-radius: 8px;">
      </div>
      <div style="background: #333; padding: 15px; border-radius: 6px; margin: 10px 0;">
        <p style="margin: 5px 0; font-size: 16px;"><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
        <p style="margin: 5px 0; color: #FFD700;"><strong>⚠️ Important:</strong> Present this QR code at the venue for entry</p>
      </div>
    </div>
  `).join('');

  const mailOptions = {
    from: process.env.MAIL_FROM || "stg.violin@gmail.com",
    to: email,
    subject: `🎫 Your ${tickets.length > 1 ? 'Tickets' : 'Ticket'} for ${ticketDetails.eventTitle}`,
    html: `
      <div style="background: linear-gradient(135deg, #000 0%, #1a1a1a 100%); color: #fff; padding: 30px; font-family: Arial, sans-serif; min-height: 100vh;">
        <div style="max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #FF3C2A; font-size: 28px; margin: 0;">🎫 Event Ticket${tickets.length > 1 ? 's' : ''}</h1>
            <p style="color: #ccc; margin: 10px 0 0 0;">Rise Up Creators</p>
          </div>
          
          <div style="background: #2a2a2a; padding: 25px; border-radius: 12px; margin: 20px 0; border: 1px solid #444;">
            <h2 style="color: #FF3C2A; margin: 0 0 20px 0; font-size: 24px;">${ticketDetails.eventTitle}</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <p style="margin: 8px 0; color: #ccc;"><strong>📅 Date:</strong></p>
                <p style="margin: 0; font-size: 16px;">${new Date(ticketDetails.date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
              </div>
              <div>
                <p style="margin: 8px 0; color: #ccc;"><strong>📍 Location:</strong></p>
                <p style="margin: 0; font-size: 16px;">${ticketDetails.location}</p>
              </div>
            </div>
            ${ticketDetails.venue ? `<p style="margin: 15px 0 0 0; color: #ccc;"><strong>🏢 Venue:</strong> ${ticketDetails.venue}</p>` : ''}
          </div>

          ${ticketHTML}

          <div style="background: #2a2a2a; padding: 20px; border-radius: 12px; margin: 30px 0; border-left: 4px solid #FFD700;">
            <h3 style="color: #FFD700; margin: 0 0 15px 0;">📋 Important Instructions</h3>
            <ul style="margin: 0; padding-left: 20px; color: #ccc;">
              <li style="margin: 8px 0;">Arrive 30 minutes before the event starts</li>
              <li style="margin: 8px 0;">Keep your QR code ready on your phone or print this email</li>
              <li style="margin: 8px 0;">Valid ID may be required at the venue</li>
              <li style="margin: 8px 0;">Screenshots of QR codes are accepted</li>
              <li style="margin: 8px 0;">Contact support if you have any issues</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0; padding: 20px; background: #1a1a1a; border-radius: 8px;">
            <p style="margin: 0; color: #ccc;">Questions? Contact us at support@riseupplatform.com</p>
            <p style="margin: 10px 0 0 0; color: #ccc;">Enjoy the event! 🎵</p>
          </div>
        </div>
      </div>
    `,
    attachments: tickets.map((ticket: any, index: number) => ({
      filename: `ticket-${index + 1}-qr.png`,
      content: (ticket.qrCode || qrCode).split(',')[1],
      encoding: 'base64',
      cid: `qr-code-${index}`
    }))
  };

  await transporter.sendMail(mailOptions);
};

export const sendArtistVerificationEmail = async (email: string, artistName: string, status: 'approved' | 'rejected', reason?: string) => {
  const mailOptions = {
    from: process.env.MAIL_FROM || "stg.violin@gmail.com",
    to: email,
    subject: `Artist Verification ${status === 'approved' ? 'Approved' : 'Update'} - Rise Up Creators`,
    html: `
      <div style="background: #000; color: #fff; padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: ${status === 'approved' ? '#22c55e' : '#ef4444'};">
          Artist Verification ${status === 'approved' ? 'Approved!' : 'Update'}
        </h1>
        <p>Hi ${artistName},</p>
        ${status === 'approved' ? 
          '<p>Congratulations! Your artist profile has been verified. You can now publish music and create content.</p>' :
          `<p>Your artist verification was not approved. ${reason ? `Reason: ${reason}` : ''}</p><p>You can reapply after addressing the issues.</p>`
        }
        <p>Best regards,<br>The Rise Up Creators Team</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

