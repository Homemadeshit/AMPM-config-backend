import nodemailer from 'nodemailer';

// Email configuration
const transporter = nodemailer.createTransport({
  // Configure your email service here
  // Example for Gmail:
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS, // Your email password or app password
  },
  // Example for SMTP:
  // host: process.env.SMTP_HOST,
  // port: parseInt(process.env.SMTP_PORT || '587'),
  // secure: false,
  // auth: {
  //   user: process.env.SMTP_USER,
  //   pass: process.env.SMTP_PASS,
  // },
});

export interface InquiryData {
  product_type: string;
  dimension: string;
  delivery_days: number;
  advance_payment: string;
  quantity: number;
  name: string;
  email: string;
  note: string;
  price?: number;
  timestamp: string;
  inquiryId: string;
}

export interface PriceBreakdown {
  base: number;
  adjustments: {
    startup_discount: number;
    first_order_discount: number;
    delivery_surcharge: number;
    advance_payment_discount: number;
    two_pcs_line_discount_total: number;
    custom_unit_adjust_eur: number;
    custom_line_adjust_eur: number;
  };
  unit: number;
  subtotal: number;
  total: number;
}

export async function sendInquiryEmail(inquiry: InquiryData, priceBreakdown?: PriceBreakdown) {
  const productType = inquiry.product_type === "dimensioned" 
    ? "Custom Dimensioned Table" 
    : inquiry.product_type.replace("_", " ").toUpperCase();
  
  const dimensions = inquiry.product_type === "dimensioned" 
    ? inquiry.dimension + " cm" 
    : "Standard size";

  const advancePayment = inquiry.advance_payment === "none" 
    ? "No advance payment" 
    : inquiry.advance_payment + "% advance";

  // Email to company
  const companyEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🔔 New INOX Table Inquiry</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">ID: ${inquiry.inquiryId}</p>
      </div>
      
      <div style="padding: 30px; background: #f8fafc;">
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">Product Configuration</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Product Type:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${productType}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Dimensions:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${dimensions}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Quantity:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${inquiry.quantity}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Delivery Time:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${inquiry.delivery_days} days</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Advance Payment:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${advancePayment}</td></tr>
            ${inquiry.price ? `<tr><td style="padding: 8px 0; color: #059669;"><strong>Estimated Total:</strong></td><td style="padding: 8px 0; color: #059669; font-size: 18px; font-weight: bold;">€${inquiry.price}</td></tr>` : ''}
          </table>
        </div>

        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">Customer Information</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${inquiry.name}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Email:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${inquiry.email}">${inquiry.email}</a></td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Submitted:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${inquiry.timestamp}</td></tr>
          </table>
          ${inquiry.note ? `<div style="margin-top: 15px;"><strong>Additional Notes:</strong><div style="background: #f1f5f9; padding: 10px; border-radius: 6px; margin-top: 5px;">${inquiry.note}</div></div>` : ''}
        </div>

        ${priceBreakdown ? `
        <div style="background: white; padding: 20px; border-radius: 12px;">
          <h2 style="color: #1e40af; margin-top: 0;">Price Breakdown</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 4px 0;">Base Price:</td><td style="text-align: right;">€${priceBreakdown.base}</td></tr>
            <tr><td style="padding: 4px 0;">Startup Discount:</td><td style="text-align: right; color: #dc2626;">-€${priceBreakdown.adjustments.startup_discount}</td></tr>
            <tr><td style="padding: 4px 0;">First Order Discount:</td><td style="text-align: right; color: #dc2626;">-€${priceBreakdown.adjustments.first_order_discount}</td></tr>
            <tr><td style="padding: 4px 0;">Delivery Surcharge:</td><td style="text-align: right;">+€${priceBreakdown.adjustments.delivery_surcharge}</td></tr>
            <tr><td style="padding: 4px 0;">Advance Payment Discount:</td><td style="text-align: right; color: #dc2626;">-€${priceBreakdown.adjustments.advance_payment_discount}</td></tr>
            ${priceBreakdown.adjustments.two_pcs_line_discount_total > 0 ? `<tr><td style="padding: 4px 0;">Bulk Discount:</td><td style="text-align: right; color: #dc2626;">-€${priceBreakdown.adjustments.two_pcs_line_discount_total}</td></tr>` : ''}
            <tr style="border-top: 2px solid #1e40af; font-weight: bold; font-size: 16px;"><td style="padding: 8px 0;">TOTAL:</td><td style="text-align: right; color: #059669;">€${priceBreakdown.total}</td></tr>
          </table>
        </div>
        ` : ''}
      </div>
      
      <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
        <p style="margin: 0; font-size: 14px;">AM & PM GLOBAL INTERNATIONAL d.o.o.</p>
        <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">Gradnikove Brigade 19, SI-5000 Nova Gorica</p>
      </div>
    </div>
  `;

  // Email to customer
  const customerEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">✅ Thank You for Your Inquiry!</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Reference ID: ${inquiry.inquiryId}</p>
      </div>
      
      <div style="padding: 30px; background: #f8fafc;">
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">Hello ${inquiry.name}!</h2>
          <p>Thank you for your interest in our INOX tables. We have received your inquiry and our sales team will prepare a detailed quote for you.</p>
          
          <h3 style="color: #1e40af;">Your Configuration Summary:</h3>
          <ul style="background: #f1f5f9; padding: 15px; border-radius: 8px; list-style: none; margin: 0;">
            <li style="padding: 5px 0;">📋 <strong>Product:</strong> ${productType}</li>
            <li style="padding: 5px 0;">📏 <strong>Dimensions:</strong> ${dimensions}</li>
            <li style="padding: 5px 0;">🔢 <strong>Quantity:</strong> ${inquiry.quantity}</li>
            <li style="padding: 5px 0;">🚚 <strong>Delivery:</strong> ${inquiry.delivery_days} days</li>
            <li style="padding: 5px 0;">💳 <strong>Payment:</strong> ${advancePayment}</li>
            ${inquiry.price ? `<li style="padding: 5px 0; color: #059669; font-weight: bold;">💰 <strong>Estimated Total:</strong> €${inquiry.price}</li>` : ''}
          </ul>
        </div>

        <div style="background: #dbeafe; padding: 20px; border-radius: 12px; border-left: 4px solid #1e40af;">
          <h3 style="color: #1e40af; margin-top: 0;">What happens next?</h3>
          <ol style="margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 10px;">Our sales team will review your requirements and prepare a detailed quote</li>
            <li style="margin-bottom: 10px;">You will receive a comprehensive proposal via email within 24 hours</li>
            <li style="margin-bottom: 10px;">We will contact you to discuss any questions and finalize your order</li>
          </ol>
        </div>
      </div>
      
      <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
        <p style="margin: 0; font-weight: bold;">AM & PM GLOBAL INTERNATIONAL d.o.o.</p>
        <p style="margin: 5px 0;">📧 office-international@ampm.si | 📞 +386 41 643 189</p>
        <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">Gradnikove Brigade 19, SI-5000 Nova Gorica, Slovenia</p>
      </div>
    </div>
  `;

  // Send email to company
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: 'office-international@ampm.si',
    subject: `🔔 New INOX Table Inquiry - ${inquiry.inquiryId} - ${productType}`,
    html: companyEmailHtml,
  });

  // Send confirmation email to customer
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: inquiry.email,
    subject: `✅ Your INOX Table Inquiry Confirmation - ${inquiry.inquiryId}`,
    html: customerEmailHtml,
  });
}
